import { randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_PHONE = 20;
const MAX_CODE_LENGTH = 32;
const DEFAULT_HOURS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function requiredText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `Campo inválido: ${field}.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new HttpsError("invalid-argument", `Preencha ${field} corretamente.`);
  }
  return normalized;
}

function normalizePhone(value: unknown): string {
  const phone = requiredText(value, "telefone", MAX_PHONE);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    throw new HttpsError("invalid-argument", "Informe um telefone válido com DDD.");
  }
  return phone;
}

function normalizeEmail(value: unknown): string {
  const email = requiredText(value, "e-mail", MAX_EMAIL).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Informe um e-mail válido.");
  }
  return email;
}

function normalizeDate(value: unknown): string {
  const date = requiredText(value, "data", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError("invalid-argument", "Data inválida.");
  }
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpsError("invalid-argument", "Data inválida.");
  }
  return date;
}

function normalizeTime(value: unknown): string {
  const time = requiredText(value, "horário", 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new HttpsError("invalid-argument", "Horário inválido.");
  }
  return time;
}

function requireAdmin(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid;
  if (!uid || request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "Acesso restrito à administração autorizada.");
  }
  return uid;
}

function requireAppCheck(request: CallableRequest<unknown>): void {
  // As opções enforceAppCheck abaixo já bloqueiam chamadas sem App Check válido.
  // Esta verificação adicional documenta a dependência no contrato das funções.
  if (!request.app) {
    throw new HttpsError("failed-precondition", "Validação do aplicativo não disponível.");
  }
}

function slotDocumentId(date: string, time: string): string {
  return `${date}_${time.replace(":", "-")}`;
}

async function configuredHours(): Promise<string[]> {
  const snap = await db.collection("appData").doc("estadoGlobal").get();
  const state = snap.data() ?? {};
  const hours = Array.isArray(state.horariosAgenda)
    ? state.horariosAgenda.filter((item): item is string =>
      typeof item === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item))
    : DEFAULT_HOURS;
  return [...new Set(hours)].sort();
}

/**
 * Cadastro público. O visitante pode criar um cadastro, mas não listar nem
 * consultar cadastros de terceiros. App Check é obrigatório.
 */
export const registerCustomer = onCall(
  { enforceAppCheck: true },
  async (request) => {
    requireAppCheck(request);
    const body = asRecord(request.data);
    const name = requiredText(body.nome, "nome", MAX_NAME);
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.telefone);

    const customer = {
      nome: name,
      email,
      telefone: phone,
      status: "pendente",
      dataCadastro: FieldValue.serverTimestamp(),
      origem: "ale-clube-app"
    };

    const ref = await db.collection("clientes").add(customer);
    logger.info("Cadastro público recebido", { customerId: ref.id });
    return { success: true, customerId: ref.id };
  }
);

/**
 * Consulta disponibilidade sem retornar nome, telefone ou documentos de clientes.
 * A leitura dos agendamentos é feita pelo Admin SDK no servidor.
 */
export const getAvailability = onCall(
  { enforceAppCheck: true },
  async (request) => {
    requireAppCheck(request);
    const body = asRecord(request.data);
    const date = normalizeDate(body.data);
    const hours = await configuredHours();

    const appointments = await db.collection("agendamentos")
      .where("data", "==", date)
      .get();
    const occupied = new Set<string>();
    appointments.forEach((doc) => {
      const hour = doc.get("hora");
      if (typeof hour === "string") occupied.add(hour);
    });

    // Também considera reservas criadas pelo novo backend.
    const slotRefs = hours.map((hour) =>
      db.collection("agenda_slots").doc(slotDocumentId(date, hour)));
    if (slotRefs.length) {
      const slots = await db.getAll(...slotRefs);
      slots.forEach((slot) => {
        if (slot.exists && slot.get("status") === "booked") {
          const hour = slot.get("hora");
          if (typeof hour === "string") occupied.add(hour);
        }
      });
    }

    return {
      data: date,
      horarios: hours.map((hora) => ({ hora, disponivel: !occupied.has(hora) }))
    };
  }
);

/**
 * Reserva atômica. agenda_slots impede duas reservas novas para o mesmo
 * horário. A coleção agendamentos continua recebendo o formato legado para
 * facilitar a transição da tela administrativa existente.
 */
export const createAppointment = onCall(
  { enforceAppCheck: true },
  async (request) => {
    requireAppCheck(request);
    const body = asRecord(request.data);
    const name = requiredText(body.nome, "nome", MAX_NAME);
    const phone = normalizePhone(body.telefone);
    const date = normalizeDate(body.data);
    const time = normalizeTime(body.hora);
    const hours = await configuredHours();

    if (!hours.includes(time)) {
      throw new HttpsError("invalid-argument", "Esse horário não está disponível para agendamento.");
    }

    const nowDate = new Date();
    const requested = new Date(`${date}T${time}:00`);
    if (Number.isNaN(requested.getTime()) || requested.getTime() <= nowDate.getTime()) {
      throw new HttpsError("failed-precondition", "Escolha uma data e horário futuros.");
    }

    const slotRef = db.collection("agenda_slots").doc(slotDocumentId(date, time));
    const appointmentRef = db.collection("agendamentos").doc();

    await db.runTransaction(async (transaction) => {
      const slot = await transaction.get(slotRef);
      if (slot.exists && slot.get("status") === "booked") {
        throw new HttpsError("already-exists", "Esse horário acabou de ser reservado. Escolha outro.");
      }

      const appointment = {
        data: date,
        hora: time,
        nome: name,
        telefone: phone,
        criadoEm: FieldValue.serverTimestamp()
      };

      transaction.set(slotRef, {
        data: date,
        hora: time,
        status: "booked",
        appointmentId: appointmentRef.id,
        criadoEm: FieldValue.serverTimestamp()
      });
      transaction.set(appointmentRef, appointment);
    });

    logger.info("Agendamento criado pelo backend", { appointmentId: appointmentRef.id, date, time });
    return { success: true, appointmentId: appointmentRef.id };
  }
);

/**
 * Valida um código VIP sem revelar titular, telefone ou outros dados.
 * Compatível com códigos legados que ainda não possuem os novos campos
 * active/expiresAt/useCount.
 */
export const validateVipCode = onCall(
  { enforceAppCheck: true },
  async (request) => {
    requireAppCheck(request);
    const body = asRecord(request.data);
    const code = requiredText(body.codigo, "código VIP", MAX_CODE_LENGTH).toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(code)) {
      throw new HttpsError("invalid-argument", "Código VIP inválido.");
    }

    const snap = await db.collection("codigos_clube").doc(code).get();
    if (!snap.exists) return { valid: false };

    const data = snap.data() ?? {};
    if (data.active === false) return { valid: false };

    const expiresAt = data.expiresAt;
    if (expiresAt instanceof Timestamp && expiresAt.toMillis() < Date.now()) {
      return { valid: false };
    }

    const maxUses = typeof data.maxUses === "number" ? data.maxUses : null;
    const useCount = typeof data.useCount === "number" ? data.useCount : 0;
    if (maxUses !== null && useCount >= maxUses) return { valid: false };

    return { valid: true };
  }
);

/**
 * Liberação VIP administrativa. Exige custom claim admin=true; o navegador
 * não pode escolher o próprio papel. Atualiza cliente e cria código numa
 * única transação.
 */
export const issueVipCode = onCall(
  { enforceAppCheck: true },
  async (request) => {
    requireAppCheck(request);
    const adminUid = requireAdmin(request);
    const body = asRecord(request.data);
    const customerId = requiredText(body.customerId, "cliente", 128);

    const customerRef = db.collection("clientes").doc(customerId);
    const customerSnap = await customerRef.get();
    if (!customerSnap.exists) {
      throw new HttpsError("not-found", "Cadastro de cliente não encontrado.");
    }

    const code = `VIP-${randomBytes(4).toString("hex").toUpperCase()}`;
    const codeRef = db.collection("codigos_clube").doc(code);
    const customer = customerSnap.data() ?? {};

    await db.runTransaction(async (transaction) => {
      const [freshCustomer, existingCode] = await Promise.all([
        transaction.get(customerRef),
        transaction.get(codeRef)
      ]);
      if (!freshCustomer.exists) {
        throw new HttpsError("not-found", "Cadastro de cliente não encontrado.");
      }
      if (existingCode.exists) {
        throw new HttpsError("already-exists", "Não foi possível gerar o código. Tente novamente.");
      }

      transaction.update(customerRef, {
        status: "pago",
        codigoAcesso: code,
        dataPagamento: new Date().toISOString()
      });
      transaction.create(codeRef, {
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: adminUid,
        customerId,
        useCount: 0
      });
    });

    logger.info("Código VIP emitido", { customerId, adminUid });
    return {
      success: true,
      codigo: code,
      nomeCliente: typeof customer.nome === "string" ? customer.nome : ""
    };
  }
);
