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


## Achados adicionais na revisão do HTML atual da main

A revisão do `index.html` mais recente identificou pontos que precisam ser tratados antes de produção:

- `appData/estadoGlobal` é carregado pelo cliente sem aguardar autenticação. O mesmo objeto contém `senhaFinanceiro`, com valor padrão `1234`, e a função `salvarEstado` grava o objeto inteiro. Esse PIN não deve permanecer no documento usado pela interface pública.
- A verificação de administrador no frontend usa uma lista de e-mails permitidos e/ou o campo `usuarios/{uid}.isAdmin`. As Cloud Functions preparadas exigem custom claim `admin: true`. Esses modelos precisam ser reconciliados; o servidor deve ser a autoridade final.
- Não encontrei `iaApiKey` nem senhas de funcionários no HTML atual da `main`. Os documentos herdados da branch antiga descrevem um estado anterior e não devem ser interpretados como confirmação desses campos na versão atual.
- O array `funcionarios` atual contém nomes e cores. Ainda é necessário decidir se essa informação fica pública ou se será movida para uma coleção privada.
- O frontend ainda consulta e grava diretamente coleções operacionais, incluindo `clientes`, `agendamentos`, `codigos_clube`, `vendas`, `financeiro` e `prontuarios`.
- `enviarPush()` mostra uma confirmação de envio, mas o próprio código marca a ação como simulação.
- O checkout registra uma venda pendente e orienta a cliente a continuar pelo WhatsApp; não foi identificada confirmação automática de pagamento por gateway neste fluxo.
- A lista de e-mails administrativos no HTML não substitui autorização validada no servidor.

## Ajuste de interpretação dos documentos herdados

Os relatórios de segurança trazidos da branch anterior foram escritos sobre uma versão anterior do aplicativo. Para a revisão atual, considerar como confirmados somente os achados reproduzidos no `index.html` atual. Em especial, a presença de `iaApiKey` e de senhas de funcionários não foi confirmada nesta versão.
