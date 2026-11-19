# Auditoria inicial — ALE CLUBE

Branch de trabalho: `melhorias/ale-clube-completo`
Base: `main` (código mais recente no início da revisão)

## Proteção da versão publicada

- Esta branch foi criada a partir de `main` para que a revisão completa use a interface atual.
- A branch `main` não foi alterada.
- A branch antiga `seguranca/ale-clube-firestore` foi preservada sem alterações.
- Nenhuma regra do Firestore foi publicada e nenhuma implantação Firebase foi executada.

## Verificações realizadas

- O HTML principal passou pela verificação estática de sintaxe JavaScript.
- A identidade visual atual usa rosa (`#9D174D`) e dourado (`#D4AF37`); a revisão deve preservar essas cores.
- O frontend atual ainda executa operações diretamente no Firestore em vários fluxos.
- O estado geral `appData/estadoGlobal` é lido pelo navegador e contém configurações de áreas públicas e administrativas.
- Cadastro, agenda e códigos VIP ainda possuem caminhos de leitura/escrita no navegador.
- O envio de notificações push contém uma resposta explicitamente simulada.
- O frontend ainda não inicializa Firebase App Check nem chama as Cloud Functions preparadas na branch anterior.
- A branch anterior já contém cinco funções callable: cadastro, disponibilidade, reserva, validação VIP e emissão VIP administrativa. O frontend ainda precisa ser migrado.

## Correção aplicada nesta branch

- A reserva do backend agora verifica, dentro da transação, tanto o bloqueio novo em `agenda_slots` quanto agendamentos ativos já existentes na coleção legada `agendamentos`. Isso reduz o risco de reservar um horário ocupado durante a migração.
- A geração de código VIP foi ampliada de 4 para 12 bytes aleatórios.

## Próximas etapas obrigatórias

1. Integrar App Check no cliente após obter a chave de site do provedor escolhido.
2. Migrar cadastro, disponibilidade, reserva e VIP para as funções callable.
3. Separar dados públicos e privados sem apagar o documento legado.
4. Definir e testar a matriz de permissões por cargo.
5. Criar regras Firestore em arquivo separado e testá-las no Emulator/Rules Playground.
6. Testar fluxos de agenda concorrente, cadastro, login, VIP, equipe, prontuário, financeiro, vitrine e PWA.
7. Somente preparar publicação depois de testes e aprovação expressa.

## Limitações desta auditoria

A verificação JavaScript é estática. Ainda não foram executados testes de navegador, Firebase Emulator, regras Firestore, autenticação real, App Check, pagamentos ou notificações.
