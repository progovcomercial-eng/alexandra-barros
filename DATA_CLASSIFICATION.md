# Inventário de dados — separação público/privado do ALE CLUBE

Branch de trabalho: `seguranca/ale-clube-firestore`

## Objetivo e limite desta etapa

Este inventário prepara a separação do documento legado `appData/estadoGlobal`. É documentação técnica: não move dados, não altera o HTML, não cria coleções no Firebase, não modifica regras e não publica alterações. A branch `main` e o app publicado permanecem fora do escopo.

A migração deverá ser feita em etapas compatíveis com o frontend atual, com cópia/backup e validação antes de qualquer remoção do documento legado.

## 1. Conteúdo que pode compor a configuração pública

A configuração pública deve conter somente informações que qualquer visitante pode ver na vitrine:

- Identidade visual: `appName`, `logo`, `logoImage`, `colorPrimary`, `colorGold`, `colorText`, `bgColor`, `bgGradient`, `bgImage`.
- Conteúdo da home: `mensagem`, `vitrineName`, `clubeName`, `clubeColor`, `clubeImage`, `clubeLink`, `renovaseName`, `renovaseColor`, `renovaseImage`, `renovaseLink`, `video`, `publicidades`, `layoutOrder`.
- Produtos exibidos: `boutiqueName`, `boutiqueProdutos` (somente nome, preço exibido, imagem e link público; nunca tokens ou credenciais de integração).
- Planos apresentados ao visitante: `precos` e `planos`, após revisão para garantir que contenham apenas descrição comercial pública.
- Contato público: `contato` (endereço comercial, horário divulgado, telefone comercial, redes sociais e canais públicos).
- Horários que a clínica oferece: `horariosAgenda` (lista de horários disponíveis, sem reservas ou identificação de clientes).
- Nome e saudação da assistente: `iaName` e `iaWelcome`, desde que não incluam dados internos.

Sugestão de destino: documento `publico/configuracao` (ou equivalente definido na implementação). Visitantes poderão ler apenas os campos públicos necessários. A edição continuará restrita à administradora/equipe autorizada.

## 2. Dados administrativos e privados

Estes dados não devem estar no documento público nem ser baixados por visitantes:

- `equipe`: nomes internos, cargos, permissões e qualquer credencial. As senhas atuais em texto simples devem ser eliminadas após migração segura para Firebase Authentication; não copiar senhas para uma nova coleção.
- `iaApiKey`: segredo de provedor. Não deve ser armazenado no Firestore acessível ao navegador nem reaparecer em HTML, estado público ou logs. Guardar em backend/Secret Manager e intermediar chamadas por função autenticada.
- `integracoes`: a lista de plataformas e seus metadados visuais pode ser pública; estado de conexão, tokens OAuth, chaves, refresh tokens e credenciais são privados e devem ficar no backend/Secret Manager.
- `planoAtual`: dado de contrato/entitlement da conta. Tratar como privado e validar limites no backend; não confiar em valor editável pelo navegador.
- Configurações administrativas, trilhas de auditoria, permissões e dados de sessão: coleção/documento privado por UID, com autorização aplicada nas regras e/ou backend.

Sugestão de destino: documentos privados vinculados ao UID da administradora/funcionário, por exemplo `usuarios/{uid}/perfilPrivado`, e segredos em Secret Manager. O modelo final deve evitar permitir que um funcionário leia dados de outro funcionário.

## 3. Coleções operacionais já usadas pelo HTML

| Coleção | Uso observado | Tratamento proposto |
|---|---|---|
| `clientes` | Cadastro público com nome, e-mail, telefone, status, pagamento e código de acesso | Leitura restrita à equipe autorizada. Cadastro público deve criar somente o próprio registro com validação e campos permitidos; operações de pagamento/VIP no backend. |
| `agendamentos` | Nome, telefone, data, hora e timestamp; consulta para calcular horários ocupados | Dados completos privados. Visitantes não devem ler nomes/telefones nem a lista de documentos; disponibilidade deve ser fornecida por backend ou estrutura pública mínima sem dados pessoais. |
| `codigos_clube` | Validação de código VIP e metadados de liberação | Não permitir leitura/escrita direta pelo navegador. Validar e resgatar em backend, com expiração, uso/limite de tentativas e resposta mínima. |
| `appData/estadoGlobal` | Mistura vitrine, equipe, chave IA e configurações | Documento legado misto. Manter durante transição controlada; depois de validar leitura/escrita nos novos destinos, retirar acesso e migrar/remover com backup e aprovação. |

## 4. Fluxos que precisam continuar funcionando

1. **Vitrine:** visitante carrega identidade visual, produtos, planos, contato e publicidade sem receber dados privados.
2. **Cadastro:** visitante envia nome, e-mail e telefone; o backend valida e grava somente os campos permitidos. A interface recebe confirmação sem poder listar cadastros.
3. **Agenda:** visitante vê horários disponíveis sem acessar dados pessoais de outros clientes; o backend verifica e reserva o horário de forma atômica para evitar dupla marcação.
4. **VIP:** visitante envia código; o backend valida o código sem revelar documento, titular, telefone ou outros códigos. A administradora gera/libera códigos por operação autorizada.
5. **Equipe:** cada pessoa usa conta individual; permissões são verificadas fora do navegador e cada ação é autorizada no servidor.
6. **IA e integrações:** chamadas passam por backend autenticado; segredos nunca são enviados ao navegador.
7. **Administração:** apenas a administradora e funcionários autorizados acessam cada função e os dados correspondentes.

## 5. Ordem segura de implementação

1. Fazer backup/exportação controlada dos dados existentes e registrar contagens, sem expor dados pessoais em commits.
2. Definir o esquema público e privado definitivo e revisar todos os campos realmente usados pelo frontend.
3. Implementar backend/Cloud Functions para cadastro, disponibilidade/reserva de agenda, validação/liberação VIP e chamadas de IA.
4. Atualizar o frontend para ler configuração pública e chamar os fluxos privados; manter compatibilidade temporária durante a migração.
5. Migrar dados administrativos com validação de contagens e amostras autorizadas; não copiar senhas em texto simples.
6. Escrever regras Firestore com negação por padrão e permissões mínimas, somente depois que os fluxos não dependerem mais do acesso antigo.
7. Testar usuário anônimo, cliente, funcionário com permissões limitadas e administradora no Firebase Emulator Suite/Rules Playground.
8. Fazer revisão funcional e de segurança; só então solicitar aprovação explícita antes de qualquer publicação.

## 6. Riscos e decisões pendentes antes do código

- Confirmar se o campo `video` é apenas mídia pública ou se guarda algum link privado; publicar somente mídia destinada à vitrine.
- Revisar cada objeto de `publicidades`, `boutiqueProdutos`, `integracoes` e `contato` para remover tokens, credenciais ou dados pessoais não destinados ao público.
- Definir política de retenção, consentimento e acesso para dados pessoais de clientes e agendamentos.
- Definir como o backend impedirá dupla reserva de data/hora.
- Definir expiração, limite de tentativas, quantidade de resgates e revogação de códigos VIP.
- Confirmar quais cargos da equipe podem ver clientes, agenda, pagamentos e configurações.
- Verificar se a chave IA já foi usada em ambiente real e, se tiver sido exposta, rotacioná-la no provedor.

## Critério para encerrar a migração

Nenhum visitante anônimo consegue ler clientes, agendamentos completos, equipe, permissões, códigos VIP ou segredos; cada fluxo público funciona sem acesso direto a dados privados; ações administrativas são autorizadas no backend/regras; os testes passam; e o proprietário aprova a publicação.
