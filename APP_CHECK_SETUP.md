# Configuração do Firebase App Check — Web

## Provedor escolhido

Para o ALE CLUBE, o provedor definido para Web é **Fraud Defense / reCAPTCHA Enterprise**. No Google Cloud, reCAPTCHA Enterprise aparece dentro do produto Fraud Defense.

A chave necessária é uma chave de site (Web) baseada em pontuação. Ela não deve mostrar desafio de checkbox às clientes.

## Criar a chave no Google Cloud

1. Abra o projeto Firebase/Google Cloud correto usando o seletor de projeto.
2. Entre em Fraud Defense / reCAPTCHA Enterprise.
3. Se a API solicitar ativação, habilite a API reCAPTCHA Enterprise e aguarde.
4. Crie uma chave do tipo Web.
5. Mantenha a verificação de domínio habilitada.
6. Adicione os domínios reais usados pelo aplicativo.
7. Não habilite desafios/checkbox.
8. Copie o ID/chave de site gerado.

Se o botão **Criar chave** não aparecer, confirme se a conta possui a função IAM **reCAPTCHA Enterprise Admin** (`roles/recaptchaenterprise.admin`) no projeto correto. Um administrador do Google Cloud pode conceder essa permissão.

Não adicione `localhost` à chave que será usada em produção. Para desenvolvimento local, use uma chave de teste separada ou o provedor de depuração do App Check.

## Registrar no Firebase

1. Abra o Firebase Console do mesmo projeto.
2. Entre em Segurança > App Check.
3. Registre o aplicativo Web usando reCAPTCHA Enterprise.
4. Informe a chave de site criada no Google Cloud.
5. Salve e monitore as métricas antes de ativar a aplicação obrigatória.

## Integração no frontend

O HTML atual ainda não carrega o SDK compatível do App Check nem inicializa o provedor. A integração deve usar `firebase-app-check-compat.js` e inicializar o App Check logo após `firebase.initializeApp(firebaseConfig)`, antes das chamadas ao Firestore/Functions.

A chave de site é pública, mas deve corresponder ao registro do mesmo aplicativo e aos domínios permitidos. Não colocar credenciais de serviço ou chaves privadas no HTML.

## Importante

- Não habilitar enforcement de Firestore ou Functions até que o frontend de teste envie tokens válidos e os fluxos tenham sido verificados.
- Não implantar Cloud Functions até que a chave, App Check, custom claim administrativa e projeto Firebase tenham sido confirmados.
- Não publicar regras restritivas antes de migrar as chamadas diretas do frontend.
