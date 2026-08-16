/**
 * Integração real com a API do Asaas (https://docs.asaas.com).
 *
 * Autenticação: header `access_token` (não é "Authorization: Bearer").
 * Ambientes:
 *   - Sandbox:    https://api-sandbox.asaas.com/v3   (chave começa com $aact_hmlg_)
 *   - Produção:   https://api.asaas.com/v3            (chave começa com $aact_prod_)
 *
 * IMPORTANTE (mudou nesta versão): cada função aqui recebe `credenciais` =
 * { apiKey, ambiente } da ACADEMIA que está fazendo a chamada (ver
 * gatewayPagamento.js, que busca isso no banco). Antes, a chave vinha de uma
 * única variável de ambiente compartilhada por todo o sistema - o que
 * significava que, com mais de uma academia usando o sistema, o dinheiro de
 * todas cairia na mesma conta Asaas. Agora cada academia usa a própria conta.
 *
 * Esse serviço é opcional: o sistema funciona 100% com baixa manual mesmo sem
 * nenhuma academia configurar o Asaas.
 */
const { supabaseAdmin } = require('../config/supabaseClient');

function gatewayConfigurado(credenciais) {
  return Boolean(credenciais?.apiKey);
}

function baseUrl(credenciais) {
  return credenciais?.ambiente === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
}

/** Faz uma chamada autenticada à API do Asaas e já trata erro no formato deles. */
async function chamarApi(credenciais, method, caminho, corpo) {
  if (!gatewayConfigurado(credenciais)) {
    throw new Error('Asaas não configurado para esta academia. Configure em Configurações > Pagamento.');
  }

  const resposta = await fetch(`${baseUrl(credenciais)}${caminho}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'SistemaAcademia/1.0',
      access_token: credenciais.apiKey,
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    const mensagem = dados?.errors?.[0]?.description || `Erro ${resposta.status} na API do Asaas.`;
    throw new Error(mensagem);
  }
  return dados;
}

/**
 * Retorna o customer_id do aluno no Asaas, criando um cliente novo lá se
 * ainda não existir (e salvando o id em alunos.asaas_customer_id para não
 * recriar a cada cobrança).
 */
async function obterOuCriarCliente(credenciais, aluno) {
  if (aluno.asaas_customer_id) return aluno.asaas_customer_id;

  const cliente = await chamarApi(credenciais, 'POST', '/customers', {
    name: aluno.nome,
    cpfCnpj: (aluno.cpf || '').replace(/\D/g, ''),
    email: aluno.email || undefined,
    mobilePhone: (aluno.telefone || '').replace(/\D/g, '') || undefined,
    postalCode: (aluno.cep || '').replace(/\D/g, '') || undefined,
    externalReference: aluno.id,
  });

  await supabaseAdmin.from('alunos').update({ asaas_customer_id: cliente.id }).eq('id', aluno.id);
  return cliente.id;
}

/** Formata o "unified shape" usado pelas rotas, a partir da resposta de /payments do Asaas. */
function formatarCobranca(cobranca) {
  return {
    gateway_payment_id: cobranca.id,
    gateway_status: cobranca.status,
    gateway_boleto_url: cobranca.bankSlipUrl || null,
    gateway_linha_digitavel: cobranca.identificationField || null,
    gateway_link: cobranca.invoiceUrl || null,
  };
}

/** Gera um boleto real para a mensalidade. */
async function gerarBoleto(credenciais, { aluno, valor, descricao, dataVencimento, referenciaExterna }) {
  const customerId = await obterOuCriarCliente(credenciais, aluno);
  const cobranca = await chamarApi(credenciais, 'POST', '/payments', {
    customer: customerId,
    billingType: 'BOLETO',
    value: Number(valor),
    dueDate: dataVencimento,
    description: descricao,
    externalReference: referenciaExterna,
  });
  return formatarCobranca(cobranca);
}

/** Gera uma cobrança via PIX real (com QR code) para a mensalidade. */
async function gerarPix(credenciais, { aluno, valor, descricao, referenciaExterna, dataVencimento }) {
  const customerId = await obterOuCriarCliente(credenciais, aluno);
  const cobranca = await chamarApi(credenciais, 'POST', '/payments', {
    customer: customerId,
    billingType: 'PIX',
    value: Number(valor),
    dueDate: dataVencimento || new Date().toISOString().slice(0, 10),
    description: descricao,
    externalReference: referenciaExterna,
  });

  const qrCode = await chamarApi(credenciais, 'GET', `/payments/${cobranca.id}/pixQrCode`);

  return {
    ...formatarCobranca(cobranca),
    gateway_link: qrCode.payload || null, // código "copia e cola"
    qr_code_base64: qrCode.encodedImage || null,
  };
}

/** Gera uma cobrança de cartão de crédito (cobrada na hora, sem salvar o cartão). */
async function gerarCobrancaCartao(credenciais, { aluno, valor, descricao, referenciaExterna, cartao, titular }) {
  const customerId = await obterOuCriarCliente(credenciais, aluno);
  const cobranca = await chamarApi(credenciais, 'POST', '/payments', {
    customer: customerId,
    billingType: 'CREDIT_CARD',
    value: Number(valor),
    dueDate: new Date().toISOString().slice(0, 10),
    description: descricao,
    externalReference: referenciaExterna,
    creditCard: {
      holderName: cartao.nomeTitular,
      number: cartao.numero,
      expiryMonth: cartao.mesValidade,
      expiryYear: cartao.anoValidade,
      ccv: cartao.codigoSeguranca,
    },
    creditCardHolderInfo: {
      name: titular.nome,
      email: titular.email,
      cpfCnpj: (titular.cpf || '').replace(/\D/g, ''),
      postalCode: (titular.cep || '').replace(/\D/g, ''),
      addressNumber: titular.numeroEndereco || 'S/N',
      mobilePhone: (titular.telefone || '').replace(/\D/g, ''),
    },
  });
  return formatarCobranca(cobranca);
}

/** Consulta o status atual de uma cobrança (usado pro polling no caixa e pelo webhook). */
async function consultarCobranca(credenciais, paymentId) {
  const cobranca = await chamarApi(credenciais, 'GET', `/payments/${paymentId}`);
  return formatarCobranca(cobranca);
}

/** Busca (de novo) o QR code de uma cobrança PIX já criada. */
async function buscarPixQrCode(credenciais, paymentId) {
  const qrCode = await chamarApi(credenciais, 'GET', `/payments/${paymentId}/pixQrCode`);
  return { payload: qrCode.payload, qr_code_base64: qrCode.encodedImage, expiracao: qrCode.expirationDate };
}

module.exports = {
  gatewayConfigurado,
  obterOuCriarCliente,
  gerarBoleto,
  gerarPix,
  gerarCobrancaCartao,
  consultarCobranca,
  buscarPixQrCode,
};
