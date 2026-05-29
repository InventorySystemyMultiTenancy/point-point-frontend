## Integração Pagamento Online Mercado Pago (PIX e Cartão)

### 1. Credenciais Mercado Pago

- Crie uma conta Mercado Pago.
- Gere seu Access Token (backend) e Public Key (frontend) em https://www.mercadopago.com.br/developers/panel

### 2. Backend

- Endpoints implementados:
  - `POST /api/payment/online-pix` (gera QR Code PIX)
  - `POST /api/payment/online-card` (processa pagamento cartão online)
- Webhook `/api/webhooks/mercadopago` recebe notificações automáticas.
- Configure variáveis no `.env`:
  - `MP_ACCESS_TOKEN=SEU_ACCESS_TOKEN`
  - `MP_DEVICE_ID=SEU_DEVICE_ID` (se usar maquininha)

### 3. Frontend

- Adicione o MercadoPago.js no `index.html`:
  ```html
  <script src="https://sdk.mercadopago.com/js/v2"></script>
  ```
- Use o componente `MercadoPagoCardForm` para coletar dados do cartão e gerar o `cardToken`.
- Envie o `cardToken`, email, amount, orderId para o backend em `/api/payment/online-card`.
- Para PIX, chame `/api/payment/online-pix` e exiba o QR Code retornado.

### 4. Fluxo de Pagamento

1. Usuário escolhe pagar online (PIX ou cartão).
2. Frontend cria pedido e chama endpoint correspondente.
3. Backend retorna QR Code (PIX) ou status do pagamento (cartão).
4. Backend recebe notificação do Mercado Pago e libera pedido.

### 5. Testes

- Use credenciais de sandbox para testar pagamentos.
- Verifique logs do backend para status e erros.

### 6. Referências

- [Documentação Mercado Pago](https://www.mercadopago.com.br/developers/pt/guides/online-payments)
- [Exemplo de integração React](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration)
