/**
 * Integração com o Mercado Pago para gerar boleto/PIX de mensalidades.
 *
 * IMPORTANTE: a API de gateways de pagamento muda com frequência.
 * Antes de usar em produção, confira a documentação atual em:
 * https://www.mercadopago.com.br/developers/pt/docs
 *
 * Cada função recebe `credenciais` = { accessToken } da ACADEMIA que está
 * fazendo a chamada (ver gatewayPagamento.js). Assim cada academia usa a
 * própria conta Mercado Pago, e o dinheiro cai na conta certa.
 *
 * Esse serviço é opcional: o sistema funciona 100% com baixa manual mesmo
 * sem nenhuma academia configurar o Mercado Pago.
 */

let MercadoPagoConfig, Payment;
try {
  ({ MercadoPagoConfig, Payment } = require('mercadopago'));
} catch (e) {
  // pacote pode não estar instalado se o gateway não for usado
}

function gatewayConfigurado(credenciais) {
  return Boolean(credenciais?.accessToken) && Boolean(MercadoPagoConfig);
}

function getClient(credenciais) {
  if (!gatewayConfigurado(credenciais)) {
    throw new Error('Mercado Pago não configurado para esta academia. Configure em Configurações > Pagamento.');
  }
  return new MercadoPagoConfig({ accessToken: credenciais.accessToken });
}

/**
 * Gera um boleto (bolbradesco) para uma mensalidade.
 */
async function gerarBoleto(credenciais, { valor, descricao, aluno, dataVencimento }) {
  const client = getClient(credenciais);
  const payment = new Payment(client);

  const [nome, ...resto] = (aluno.nome || 'Aluno').split(' ');
  const sobrenome = resto.join(' ') || 'Academia';

  const result = await payment.create({
    body: {
      transaction_amount: Number(valor),
      description: descricao || 'Mensalidade Academia',
      payment_method_id: 'bolbradesco',
      date_of_expiration: dataVencimento
        ? new Date(`${dataVencimento}T23:59:59.000-03:00`).toISOString()
        : undefined,
      payer: {
        email: aluno.email || 'aluno@exemplo.com',
        first_name: nome,
        last_name: sobrenome,
        identification: { type: 'CPF', number: (aluno.cpf || '').replace(/\D/g, '') },
      },
    },
  });

  return {
    gateway_payment_id: String(result.id),
    gateway_status: result.status,
    gateway_boleto_url: result.transaction_details?.external_resource_url || null,
    gateway_linha_digitavel: result.barcode?.content || null,
  };
}

/**
 * Gera uma cobrança via PIX para uma mensalidade.
 */
async function gerarPix(credenciais, { valor, descricao, aluno }) {
  const client = getClient(credenciais);
  const payment = new Payment(client);

  const [nome, ...resto] = (aluno.nome || 'Aluno').split(' ');
  const sobrenome = resto.join(' ') || 'Academia';

  const result = await payment.create({
    body: {
      transaction_amount: Number(valor),
      description: descricao || 'Mensalidade Academia',
      payment_method_id: 'pix',
      payer: {
        email: aluno.email || 'aluno@exemplo.com',
        first_name: nome,
        last_name: sobrenome,
        identification: { type: 'CPF', number: (aluno.cpf || '').replace(/\D/g, '') },
      },
    },
  });

  return {
    gateway_payment_id: String(result.id),
    gateway_status: result.status,
    gateway_link: result.point_of_interaction?.transaction_data?.ticket_url || null,
    qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64 || null,
  };
}

/**
 * Consulta o status atual de um pagamento no Mercado Pago (usado pelo webhook).
 */
async function consultarPagamento(credenciais, paymentId) {
  const client = getClient(credenciais);
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

module.exports = { gatewayConfigurado, gerarBoleto, gerarPix, consultarPagamento };
