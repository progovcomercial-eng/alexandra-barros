# Relatório técnico de implementação — Segurança do ALE CLUBE

Branch de trabalho: `seguranca/ale-clube-firestore`

## Escopo e proteção da produção

Este relatório é documentação de trabalho. Não altera o HTML, não altera regras do Firestore, não migra dados e não publica nada no Firebase. A branch principal `main` e a versão publicada devem permanecer intactas até que os testes sejam concluídos e o proprietário aprove a publicação.

## Achados confirmados no index.html desta branch

1. O app inicializa Firebase Authentication e Firestore.
2. O login administrativo usa Firebase Authentication e compara o e-mail com `progovcomercial@gmail.com`.
3. O listener de `appData/estadoGlobal` é iniciado no navegador sem aguardar autenticação. O documento é usado para compor a interface pública e também contém configurações administrativas.
4. O salvamento do estado verifica `adminAutenticado` no JavaScript, mas essa verificação no navegador não substitui regras de segurança no Firestore.
5. O estado geral contém `equipe` e `iaApiKey`. A tela de equipe mostra as senhas e o cadastro grava a senha em texto simples no estado.
6. O formulário público grava dados pessoais em `clientes`.
7. A validação de código VIP lê `codigos_clube/{codigo}) diretamente do navegador.
8. A liberação VIP atualiza `clientes` e cria documentos em `codigos_clube` pelo cliente web.
9. A agenda consulta documentos de `agendamentos` para saber horários ocupados e grava solicitações com nome e telefone.
10. A tela administrativa lê os agendamentos e os dados dos clientes.

## Observação sobre a configuração Firebase

O objeto `firebaseConfig` no HTML contém a configuração pública do aplicativo Firebase. A presença da `apiKey` de configuração web, por si só, não equivale a expor uma chave privada de servidor. A proteção real dos dados depende das regras do Firestore, da autenticação, da validação de autorização e de não colocar segredos de provedores no frontend.

## Arquitetura de correção recomendada

### Fase 1 — separar conteúdo público e dados administrativos

- Manter em documento público somente conteúdo necessário à vitrine: identidade visual, textos, links, produtos, planos, horários públicos e materiais promocionais.
- Não incluir nesse documento senhas, chaves de IA, dados de clientes, dados completos de agendamentos, códigos VIP ou permissões privadas.
- Criar documentos/coleções administrativos separados, acessíveis apenas a usuários autenticados e autorizados por regra de servidor.
- Antes de mover dados existentes, inventariar e exportar os registros relevantes; não apagar ou sobrescrever dados automaticamente.

### Fase 2 — equipe e autenticação

- Migrar cada funcionário para Firebase Authentication (ou fluxo de identidade equivalente), com conta individual.
- Guardar cargo e permissões em documento privado associado ao UID, e validar a autorização nas regras/servidor.
- Remover senhas em texto simples do estado, da interface e de qualquer documento Firestore.
- Não confiar em `role-select`, `adminAutenticado` ou permissões calculadas apenas no JavaScript como barreira de segurança.
- Definir o processo de convite, redefinição de senha e revogação de acesso antes de remover o mecanismo antigo.

### Fase 3 — chave da IA

- Remover o campo de chave OpenAI do HTML e do estado público.
- Armazenar a chave somente em backend/gerenciador de segredos.
- Encaminhar chamadas da IA por função/backend com autenticação, limites de uso e validação.
- Se uma chave real já tiver sido inserida no frontend ou em documento público, revogá-la e gerar outra no provedor.

### Fase 4 — cadastro, agenda e VIP

- Cadastro público: permitir somente criação validada de um registro próprio, sem leitura/listagem de outros clientes. Avaliar App Check, validação de formato e proteção contra abuso.
- Agenda: evitar leitura pública de nomes e telefones. Disponibilidade deve ser calculada por backend ou por uma estrutura que exponha somente horários ocupados, sem dados pessoais. A criação deve validar data, horário e duplicidade no servidor.
- VIP: mover emissão e validação de códigos para backend, com expiração, uso/estado, limitação de tentativas e respostas que não revelem dados pessoais.
- Administração: leitura e alteração de clientes/agendamentos somente para usuários autorizados.

### Fase 5 — regras e testes

- Escrever regras de Firestore com negação por padrão.
- Liberar apenas as operações públicas estritamente necessárias, validando campos, tipos, tamanho e propriedade.
- Testar acesso anônimo, usuário autenticado comum, funcionário com permissões limitadas e administradora.
- Testar cadastro, agenda, cancelamento/alteração se existir, liberação VIP, validação VIP, equipe e edição da vitrine.
- Executar testes no Firebase Emulator Suite ou Rules Playground antes de qualquer publicação.
- Não publicar regras até que todos os fluxos essenciais estejam validados.

## Próximo passo técnico

Antes de escrever regras finais, implementar e testar o backend/Cloud Functions para os fluxos que hoje dependem de leitura ou gravação direta de dados privados. Em paralelo, preparar a separação entre estado público e administrativo. Não aplicar regras restritivas enquanto o frontend ainda depender dos acessos públicos atuais, pois isso pode interromper cadastro, agenda e VIP.

## Critério de conclusão

A correção só será considerada concluída quando:
- não houver senhas em texto simples no Firestore ou na interface;
- não houver chave de provedor no HTML ou em documento público;
- dados pessoais de clientes e agendamentos não forem legíveis anonimamente;
- emissão e validação VIP ocorrerem em fluxo protegido;
- cada operação administrativa for autorizada no servidor;
- os fluxos públicos e administrativos forem testados;
- o proprietário aprovar explicitamente a publicação.
