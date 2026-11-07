# Backend do ALE CLUBE — Cloud Functions

Este diretório contém uma primeira camada de backend para substituir gradualmente as operações sensíveis feitas diretamente pelo navegador.

## Estado desta entrega

- Código-fonte preparado em TypeScript para Cloud Functions for Firebase (2ª geração).
- Funções exigem App Check.
- Ações administrativas exigem custom claim `admin: true`.
- Nenhuma regra Firestore foi criada ou publicada.
- O HTML atual ainda não foi migrado para chamar estas funções.
- **Não implantar em produção antes de integrar App Check no cliente, configurar a claim da administradora e executar os testes.**

## Funções

| Callable | Acesso | Responsabilidade |
|---|---|---|
| `registerCustomer` | Público + App Check | Cria cadastro com campos validados, sem oferecer listagem. |
| `getAvailability` | Público + App Check | Retorna horários e disponibilidade, sem dados pessoais. |
| `createAppointment` | Público + App Check | Reserva atomicamente um horário e grava o formato legado em `agendamentos`. |
| `validateVipCode` | Público + App Check | Informa apenas se o código existe e está válido. |
| `issueVipCode` | Admin + App Check | Atualiza o cadastro e emite um código VIP numa transação. |

## Pré-requisitos

- Node.js 20.
- Firebase CLI instalado e autenticado.
- Projeto Firebase correto selecionado no ambiente.
- Plano Firebase compatível com Cloud Functions e faturamento habilitado.
- App Check configurado no app web (reCAPTCHA Enterprise ou provedor compatível).
- Custom claim administrativa atribuída à conta da proprietária por processo confiável no servidor.

## Instalação e compilação local

A partir desta pasta:

```bash
npm install
npm run build
```

Para emuladores, na raiz do projeto Firebase:

```bash
firebase emulators:start --only functions,firestore
```

A configuração do Firebase CLI na raiz ainda precisa ser conciliada com a hospedagem já existente. Não sobrescreva um `firebase.json` existente sem revisar os alvos de Hosting e os demais recursos.

## Custom claim da administradora

A função administrativa não confia em e-mail, campo de formulário, seletor de cargo ou variável JavaScript. Ela exige o token autenticado com `admin === true`.

A claim deve ser atribuída uma única vez por um operador confiável usando Firebase Admin SDK em ambiente seguro, após confirmar o UID da conta proprietária. Não coloque credenciais de service account no repositório ou no navegador.

Exemplo para executar apenas em ambiente administrativo confiável (não no frontend):

```js
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

initializeApp({ credential: applicationDefault() });
await getAuth().setCustomUserClaims("UID_CONFIRMADO_DA_PROPRIETARIA", {
  admin: true
});
```

Depois da alteração, a proprietária deve sair e entrar novamente para receber um ID token atualizado. Não atribua a claim a funcionários sem definir antes a matriz de permissões.

## Contratos de dados

### Cadastro

Entrada: `{ nome, email, telefone }`

Saída: `{ success, customerId }`

A função cria em `clientes` apenas os campos permitidos e o status inicial `pendente`. Não há função pública de listagem ou leitura de clientes.

### Agenda

Entrada para disponibilidade: `{ data: "AAAA-MM-DD" }`

Saída: `{ data, horarios: [{ hora, disponivel }] }`

Entrada para reserva: `{ nome, telefone, data, hora }`

A reserva usa `agenda_slots/{data}_{hora}` como trava transacional e grava também em `agendamentos` para compatibilidade com a tela administrativa atual. A tela antiga ainda grava diretamente no Firestore; enquanto ela não for migrada, reservas antigas podem não usar a trava. A migração do frontend é obrigatória antes de considerar a prevenção de dupla reserva completa.

### VIP

Validação: `{ codigo }` → `{ valid }`

Emissão administrativa: `{ customerId }` → `{ success, codigo, nomeCliente }`

Códigos legados sem `active`, `expiresAt` ou `useCount` são tratados como ativos e sem expiração, para não invalidar códigos existentes durante a transição. A política de validade, quantidade de usos e resgate precisa ser decidida antes de ativar novas regras.

## Testes obrigatórios antes de produção

1. Sem App Check: todas as funções devem rejeitar a chamada.
2. Cadastro: dados ausentes, e-mail inválido e telefone inválido são rejeitados.
3. Cadastro válido: cria apenas um documento e não permite consulta de outros clientes.
4. Disponibilidade: retorna somente horário e indicador; nenhum nome ou telefone aparece na resposta.
5. Concorrência: duas chamadas simultâneas para o mesmo horário resultam em uma única reserva.
6. VIP: código inexistente, inativo e expirado retorna `valid: false`; código ativo retorna somente `valid: true`.
7. Emissão VIP: usuário sem custom claim recebe `permission-denied`; administradora autorizada atualiza cliente e cria código atomicamente.
8. Falha no meio de uma transação: não pode deixar cliente pago sem código ou código sem atualização do cliente.
9. Validar no Emulator Suite com perfis anônimo, cliente, funcionário e administradora.
10. Só depois da integração e dos testes, preparar regras Firestore restritivas em uma etapa separada.

## Atenções da migração

- O app atual lê `appData/estadoGlobal` diretamente e esse documento mistura conteúdo público e privado. A função de disponibilidade lê somente `horariosAgenda` no servidor; isso não torna o documento seguro para leitura pública.
- O frontend atual chama diretamente `clientes`, `agendamentos` e `codigos_clube`. Não aplique regras restritivas até substituir essas chamadas por callable functions e testar a experiência completa.
- A função `createAppointment` ainda precisa de política para horários passados considerando o fuso horário oficial da clínica. O código usa a data/hora local do runtime da função; valide o fuso antes da produção.
- App Check reduz chamadas abusivas, mas não substitui rate limiting, validação de negócio, monitoramento ou regras Firestore.
- Não existe ainda migração automática dos dados existentes nem remoção do documento legado.
