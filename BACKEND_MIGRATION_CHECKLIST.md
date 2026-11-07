# Checklist de migração do frontend para o backend — ALE CLUBE

Branch: `seguranca/ale-clube-firestore`

## Chamadas atuais a substituir

- [ ] Cadastro: trocar `db.collection("clientes").add(...)` por `registerCustomer({ nome, email, telefone })`.
- [ ] Disponibilidade: trocar consulta pública de `agendamentos` por `getAvailability({ data })`.
- [ ] Reserva: trocar `db.collection("agendamentos").add(...)` por `createAppointment({ nome, telefone, data, hora })`.
- [ ] Validação VIP: trocar leitura de `codigos_clube/{codigo}` por `validateVipCode({ codigo })`.
- [ ] Emissão VIP: trocar escrita direta em `clientes` e `codigos_clube` por `issueVipCode({ customerId })`.
- [ ] Listagem administrativa de clientes e agenda: criar chamadas administrativas específicas com paginação e autorização; não reutilizar endpoints públicos.
- [ ] Login administrativo: após autenticação, confirmar custom claim e tratar ausência da claim sem liberar a área administrativa.
- [ ] Integrar Firebase App Check no app web antes de chamar as funções.

## Compatibilidade e testes

- [ ] Manter temporariamente as coleções legadas e os documentos existentes.
- [ ] Testar cadastro e confirmação na interface.
- [ ] Testar agenda em dois navegadores tentando reservar o mesmo horário.
- [ ] Testar código VIP legado e código recém-emitido.
- [ ] Testar perfil anônimo, cliente, funcionário e administradora.
- [ ] Confirmar que respostas públicas não incluem dados pessoais.
- [ ] Só depois de todos os testes, preparar regras Firestore deny-by-default em arquivo separado.
- [ ] Não publicar nem mesclar na `main` sem aprovação expressa do proprietário.

## Pendências para decisão do produto

- [ ] Fuso horário oficial da clínica.
- [ ] Política de expiração e quantidade de usos dos códigos VIP.
- [ ] Se o VIP é apenas validado ou consumido no primeiro uso.
- [ ] Matriz de permissões por cargo da equipe.
- [ ] Política de retenção e exclusão de cadastros e agendamentos.
