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

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeInterval(body: JsonRecord): { start: string; end: string } {
  const start = normalizeTime(body.horaInicio);
  const end = normalizeTime(body.horaFim);
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    throw new HttpsError("invalid-argument", "O horário final deve ser depois do horário inicial.");
  }
  if (timeToMinutes(end) - timeToMinutes(start) > 8 * 60) {
    throw new HttpsError("invalid-argument", "A duração do agendamento excede o limite permitido.");
  }
  return { start, end };
}

function isCancelled(data: JsonRecord): boolean {
  return data.status === "cancelado" || data.statusConfirmacao === "cancelado";
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(startB) < timeToMinutes(endA);
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
    const { start, end } = normalizeInterval(body);
    const employeeId = requiredText(body.funcionarioId, "profissional", 128);
    const appointments = await db.collection("agendamentos").where("data", "==", date).get();
    const available = appointments.docs.every((doc) => {
      const appointment = asRecord(doc.data());
      if (isCancelled(appointment)) return true;
      if (String(appointment.funcionarioId || "f1") !== employeeId) return true;
      const existingStart = typeof appointment.horaInicio === "string" ? appointment.horaInicio : typeof appointment.hora === "string" ? appointment.hora : null;
      const existingEnd = typeof appointment.horaFim === "string" ? appointment.horaFim : existingStart;
      if (!existingStart || !existingEnd) return true;
      return !overlaps(start, end, existingStart, existingEnd);
    });
    return { data: date, funcionarioId: employeeId, horaInicio: start, horaFim: end, disponivel: available };
  }
);

/**
 * Reserva pública no formato da agenda atual: intervalo e profissional.
 * Considera conflitos de horário e ignora agendamentos cancelados.
 */
export const createAppointment = onCall(
  { enforceAppCheck: true },
  async (request) => {
    requireAppCheck(request);
    const body = asRecord(request.data);
    const name = requiredText(body.nome, "nome", MAX_NAME);
    const phone = normalizePhone(body.telefone);
    const service = requiredText(body.servico, "serviço", 160);
    const date = normalizeDate(body.data);
    const { start, end } = normalizeInterval(body);
    const employeeId = requiredText(body.funcionarioId, "profissional", 128);
    const employeeName = requiredText(body.funcionarioNome, "nome do profissional", MAX_NAME);
    const nowParts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const nowValues = Object.fromEntries(nowParts.map((part) => [part.type, part.value]));
    const clinicNow = `${nowValues.year}-${nowValues.month}-${nowValues.day} ${nowValues.hour}:${nowValues.minute}`;
    if (`${date} ${start}` <= clinicNow) throw new HttpsError("failed-precondition", "Escolha uma data e horário futuros.");
    const appointmentsQuery = db.collection("agendamentos").where("data", "==", date);
    const appointmentRef = db.collection("agendamentos").doc();
    await db.runTransaction(async (transaction) => {
      const existingAppointments = await transaction.get(appointmentsQuery);
      const conflict = existingAppointments.docs.some((doc) => {
        const existing = asRecord(doc.data());
        if (isCancelled(existing)) return false;
        if (String(existing.funcionarioId || "f1") !== employeeId) return false;
        const existingStart = typeof existing.horaInicio === "string" ? existing.horaInicio : typeof existing.hora === "string" ? existing.hora : null;
        const existingEnd = typeof existing.horaFim === "string" ? existing.horaFim : existingStart;
        return Boolean(existingStart && existingEnd && overlaps(start, end, existingStart, existingEnd));
      });
      if (conflict) throw new HttpsError("already-exists", "Esse profissional já possui um agendamento nesse intervalo.");
      transaction.create(appointmentRef, { data: date, horaInicio: start, horaFim: end, nome: name, telefone: phone, servico: service, funcionarioId: employeeId, funcionarioNome: employeeName, statusConfirmacao: "pendente", avisoEnviado: false, criadoEm: FieldValue.serverTimestamp() });
    });
    logger.info("Agendamento criado pelo backend", { appointmentId: appointmentRef.id, date, employeeId });
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

    const code = `VIP-${randomBytes(12).toString("hex").toUpperCase()}`;
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
