const { supabaseAdmin } = require('../config/supabaseClient');
const { descriptografar } = require('./criptografia');
const asaas = require('./asaasService');
const mercadoPago = require('./mercadoPagoService');

/**
 * Camada única por onde o resto do backend fala com "o gateway de
 * pagamento" sem precisar saber se é Asaas ou Mercado Pago.
 *
 * Cada academia configura a própria conta em Configurações > Pagamento
 * (tela nova). Se uma academia não configurou nada ainda, cai de volta pras
 * variáveis de ambiente globais do .env (comportamento antigo, mantido só
 * pra não quebrar quem já estava usando assim).
 */

async function obterCredenciais(academiaId) {
  const { data: academia, error } = await supabaseAdmin
    .from('academias')
    .select('gateway_provider_preferido, asaas_api_key_cripto, asaas_ambiente, mercadopago_access_token_cripto')
    .eq('id', academiaId)
    .single();
  if (error) throw error;

  const chaveAsaasPropria = descriptografar(academia.asaas_api_key_cripto);
  const tokenMpProprio = descriptografar(academia.mercadopago_access_token_cripto);

  const asaasCred = {
    apiKey: chaveAsaasPropria || process.env.ASAAS_API_KEY || null,
    ambiente: chaveAsaasPropria ? academia.asaas_ambiente : (process.env.ASAAS_ENV === 'production' ? 'production' : 'sandbox'),
  };
  const mpCred = { accessToken: tokenMpProprio || process.env.MERCADOPAGO_ACCESS_TOKEN || null };

  const asaasOk = asaas.gatewayConfigurado(asaasCred);
  const mpOk = mercadoPago.gatewayConfigurado(mpCred);

  let provedor = null;
  if (academia.gateway_provider_preferido === 'asaas' && asaasOk) provedor = 'asaas';
  else if (academia.gateway_provider_preferido === 'mercadopago' && mpOk) provedor = 'mercadopago';
  else if (asaasOk) provedor = 'asaas';
  else if (mpOk) provedor = 'mercadopago';

  return { provedor, asaasCred, mpCred, asaasOk, mpOk };
}

async function provedorAtivo(academiaId) {
  return (await obterCredenciais(academiaId)).provedor;
}

async function gatewayConfigurado(academiaId) {
  const { asaasOk, mpOk } = await obterCredenciais(academiaId);
  return asaasOk || mpOk;
}

async function gerarBoleto(academiaId, params) {
  const { provedor, asaasCred, mpCred } = await obterCredenciais(academiaId);
  if (!provedor) throw new Error('Nenhum gateway de pagamento configurado para esta academia.');
  const resultado =
    provedor === 'asaas' ? await asaas.gerarBoleto(asaasCred, params) : await mercadoPago.gerarBoleto(mpCred, params);
  return { ...resultado, gateway_provider: provedor };
}

async function gerarPix(academiaId, params) {
  const { provedor, asaasCred, mpCred } = await obterCredenciais(academiaId);
  if (!provedor) throw new Error('Nenhum gateway de pagamento configurado para esta academia.');
  const resultado =
    provedor === 'asaas' ? await asaas.gerarPix(asaasCred, params) : await mercadoPago.gerarPix(mpCred, params);
  return { ...resultado, gateway_provider: provedor };
}

// Cobrança direta pelo número do cartão (sem redirecionar o aluno) só é
// suportada via Asaas: é a API deles que aceita o número do cartão direto no
// servidor. O Mercado Pago exige tokenizar o cartão no navegador do aluno por
// motivos de segurança (PCI), o que pediria uma tela de checkout própria.
async function gerarCobrancaCartao(academiaId, params) {
  const { asaasCred, asaasOk } = await obterCredenciais(academiaId);
  if (!asaasOk) {
    throw new Error(
      'Cobrança direta por cartão só está disponível via Asaas. Configure o Asaas em Configurações > Pagamento, ou use PIX/boleto.'
    );
  }
  const resultado = await asaas.gerarCobrancaCartao(asaasCred, params);
  return { ...resultado, gateway_provider: 'asaas' };
}

// `provider` aqui é o gateway que foi usado quando ESSA cobrança específica
// foi criada (guardado em mensalidades.gateway_provider) - importante
// porque uma academia pode trocar de gateway preferido depois, mas cobranças
// antigas continuam vivendo no provedor onde nasceram.
async function consultarCobranca(academiaId, provider, paymentId) {
  const { asaasCred, mpCred } = await obterCredenciais(academiaId);
  if (provider === 'asaas') {
    return { ...(await asaas.consultarCobranca(asaasCred, paymentId)), gateway_provider: 'asaas' };
  }
  if (provider === 'mercadopago') {
    const pagamento = await mercadoPago.consultarPagamento(mpCred, paymentId);
    return { gateway_payment_id: String(pagamento.id), gateway_status: pagamento.status, gateway_provider: 'mercadopago' };
  }
  throw new Error('Provedor de gateway desconhecido nesta mensalidade.');
}

async function buscarPixQrCode(academiaId, provider, paymentId) {
  const { asaasCred } = await obterCredenciais(academiaId);
  if (provider !== 'asaas') {
    throw new Error('Recuperar o QR code de novo só está disponível pra cobranças criadas via Asaas.');
  }
  return asaas.buscarPixQrCode(asaasCred, paymentId);
}

module.exports = {
  obterCredenciais,
  provedorAtivo,
  gatewayConfigurado,
  gerarBoleto,
  gerarPix,
  gerarCobrancaCartao,
  consultarCobranca,
  buscarPixQrCode,
};
