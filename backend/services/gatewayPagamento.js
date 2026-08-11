/**
 * Escolhe automaticamente qual gateway de pagamento usar, sem a tela ou as
 * rotas precisarem saber qual está configurado. Prioridade: Asaas (recomendado
 * para academias - tem cobrança recorrente, boleto, PIX e notificação
 * automática de cobrança nativos) e, se não estiver configurado, Mercado Pago.
 */
const asaas = require('./asaasService');
const mercadoPago = require('./mercadoPagoService');

function provedorAtivo() {
  if (asaas.gatewayConfigurado()) return 'asaas';
  if (mercadoPago.gatewayConfigurado()) return 'mercadopago';
  return null;
}

function gatewayConfigurado() {
  return Boolean(provedorAtivo());
}

async function gerarBoleto(params) {
  const provedor = provedorAtivo();
  if (!provedor) throw new Error('Nenhum gateway de pagamento configurado.');
  const resultado = provedor === 'asaas' ? await asaas.gerarBoleto(params) : await mercadoPago.gerarBoleto(params);
  return { gateway_provider: provedor, ...resultado };
}

async function gerarPix(params) {
  const provedor = provedorAtivo();
  if (!provedor) throw new Error('Nenhum gateway de pagamento configurado.');
  const resultado = provedor === 'asaas' ? await asaas.gerarPix(params) : await mercadoPago.gerarPix(params);
  return { gateway_provider: provedor, ...resultado };
}

// Cobrança de cartão de crédito: hoje só implementada via Asaas.
async function gerarCobrancaCartao(params) {
  if (!asaas.gatewayConfigurado()) {
    throw new Error('Cobrança por cartão disponível apenas com o Asaas configurado.');
  }
  const resultado = await asaas.gerarCobrancaCartao(params);
  return { gateway_provider: 'asaas', ...resultado };
}

// Consulta de status: precisa saber qual provedor gerou aquela cobrança específica.
async function consultarCobranca(provider, paymentId) {
  if (provider === 'asaas') return asaas.consultarCobranca(paymentId);
  if (provider === 'mercadopago') {
    const pagamento = await mercadoPago.consultarPagamento(paymentId);
    return { gateway_status: pagamento.status };
  }
  throw new Error('Provedor de pagamento desconhecido.');
}

async function buscarPixQrCode(provider, paymentId) {
  if (provider === 'asaas') return asaas.buscarPixQrCode(paymentId);
  throw new Error('Recuperar QR code avulso hoje só é suportado com Asaas.');
}

module.exports = {
  provedorAtivo,
  gatewayConfigurado,
  gerarBoleto,
  gerarPix,
  gerarCobrancaCartao,
  consultarCobranca,
  buscarPixQrCode,
};
