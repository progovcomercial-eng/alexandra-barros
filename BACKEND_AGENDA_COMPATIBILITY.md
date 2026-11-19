# Compatibilidade da agenda — ALE CLUBE

Branch: `melhorias/ale-clube-completo`

## Alteração preparada

As funções `getAvailability` e `createAppointment` agora aceitam o modelo de agenda encontrado no `index.html` atual:

- `data` no formato `AAAA-MM-DD`;
- `horaInicio` e `horaFim`;
- `nome`, `telefone` e `servico`;
- `funcionarioId` e `funcionarioNome`;
- `statusConfirmacao`, `avisoEnviado` e `criadoEm` no documento criado.

A verificação de disponibilidade considera sobreposição de intervalos para o mesmo profissional e ignora agendamentos com status cancelado. Agendamentos antigos com apenas `hora` são interpretados como ocupação pontual desse horário.

## Importante: ainda não integrado ao HTML

O `index.html` continua fazendo leitura e gravação direta na coleção `agendamentos`. Esta alteração prepara as funções, mas não muda o fluxo da tela nem direciona as chamadas do aplicativo para o backend.

Antes de integrar, precisamos adaptar e testar:
1. chamada de `getAvailability` com data, início, fim e profissional;
2. chamada de `createAppointment` com os campos acima;
3. edição, remarcação e cancelamento de agendamentos;
4. confirmação de que as telas administrativas continuam exibindo os mesmos campos.

## Segurança e publicação

- Nenhuma regra do Firestore foi alterada.
- Nenhuma Cloud Function foi publicada.
- Nenhum dado do Firebase foi migrado ou apagado.
- As funções continuam com `enforceAppCheck: true`; portanto, chamadas reais continuarão dependendo de uma configuração App Check válida.
- A autorização administrativa ainda precisa ser alinhada: o HTML atual verifica e-mail/`usuarios/{uid}.isAdmin`, enquanto `issueVipCode` exige custom claim `admin: true`.

## Testes necessários antes de publicar

- Horário livre para o profissional selecionado.
- Conflito com intervalo parcialmente sobreposto.
- Mesmo horário em profissionais diferentes.
- Agendamento cancelado não bloqueia o horário.
- Data e intervalo inválidos são recusados.
- Data/hora passada é recusada.
- Usuário sem autenticação não consegue emitir código VIP.
- Chamadas sem App Check válido são recusadas.

A compilação TypeScript e os testes no Firebase Emulator Suite ainda precisam ser executados. Não considerar a implementação validada até essa etapa.
