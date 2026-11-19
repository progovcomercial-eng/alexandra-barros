# Plano de correção de segurança — ALE CLUBE

Este documento registra a auditoria inicial do HTML atual. Nenhuma regra do Firestore foi publicada ou alterada nesta etapa.

## Situação confirmada

- O aplicativo usa Firebase Web SDK compatível e o projeto `aleclube`.
- O documento `appData/estadoGlobal` é carregado com `onSnapshot` sem autenticação.
- O documento de estado contém dados operacionais e configurações usados pela interface pública.
- A tela de equipe grava senhas em texto simples dentro de `appState.equipe`, e a interface imprime essas senhas.
- A configuração da Assistente IA possui campo `iaApiKey` dentro do mesmo estado geral.
- A verificação de códigos VIP consulta diretamente `codigos_clube/{codigo}` no navegador.
- O cadastro público cria documentos em `clientes`.
- A agenda consulta horários e grava documentos com nome e telefone; a administração lê os agendamentos.
- As regras mostradas pelo proprietário permitem leitura e escrita irrestritas nas coleções `appData`, `agendamentos`, `clientes` e `codigos_clube` (`if true`).

## Riscos prioritários

1. **Dados pessoais:** regras públicas de leitura permitem exposição de nomes, telefones e e-mails de clientes e agendamentos.
2. **Integridade:** regras públicas de escrita permitem adulterar ou apagar configurações, cadastros e códigos.
3. **Senhas de funcionários:** não devem ser armazenadas nem exibidas em texto simples no Firestore.
4. **Chave da IA:** uma chave de provedor não pode ficar no HTML nem em documento lido pelo navegador. Deve ser guardada em serviço de backend/secret manager.
5. **Códigos VIP:** liberar leitura pública por código curto permite tentativa automatizada de adivinhação. A validação deve migrar para backend autenticado/limitado ou para um fluxo de autenticação de cliente.

## Plano recomendado, em etapas

### Etapa A — remover segredos do estado público
- Migrar a autenticação de funcionários para Firebase Authentication; não guardar senha em `appState`.
- Remover o campo de chave OpenAI do HTML e do documento público; chamadas de IA devem passar por backend.
- Antes da migração, não apagar os dados antigos automaticamente: exportar/identificar os registros existentes e planejar a migração.

### Etapa B — separar dados públicos e privados
- Manter em `appData` somente conteúdo realmente público (nome, cores, produtos, planos, textos e links).
- Criar documento/coleção privada para configurações administrativas, com leitura/escrita somente por administradores autenticados.
- Manter clientes e agendamentos privados; cadastro e solicitação pública devem passar por validação segura, sem permitir leitura pública.
- Mover validação e emissão de códigos VIP para backend, com limitação de tentativas.

### Etapa C — regras do Firestore
- Exigir autenticação e verificar o e-mail administrativo autorizado nas operações administrativas.
- Negar leitura/listagem pública de clientes, agendamentos, equipe, segredos e códigos VIP.
- Permitir apenas as operações públicas estritamente necessárias, com validação de campos e tipos.
- Testar regras no Firebase Emulator/Rules Playground antes de publicar.

## Critérios para publicar
- Login administrativo testado.
- Cadastro público testado sem permitir leitura de outros clientes.
- Agenda testada sem expor nome/telefone ao público.
- Consulta VIP testada sem permitir enumeração de códigos.
- Equipe sem senhas em texto simples.
- Chave de IA ausente do HTML e do Firestore público.
- Regras testadas e compatíveis com todos os fluxos.

## Estado desta alteração
- Arquivo de auditoria adicionado somente à branch `seguranca/ale-clube-firestore`.
- HTML original e banco de produção não foram alterados.
- Nenhuma regra foi publicada.
