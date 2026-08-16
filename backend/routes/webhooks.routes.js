const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const mercadoPago = require('../services/mercadoPagoService');
const asaas = require('../services/asaasService');
const gatewayPagamento = require('../services/gatewayPagamento');
const mensalidadeService = require('../services/mensalidadeService');

const router = express.Router();

// ----------------------------------------------------------------------------
// Sobre segurança destes webhooks (importante, leia antes de mudar):
//
// Cada academia tem sua própria conta/chave de gateway (ver
// services/gatewayPagamento.js), então não existe mais "um token secreto
// único" pra validar a chamada como antes. Em vez disso, ao receber a
// notificação, primeiro achamos A QUAL MENSALIDADE/ACADEMIA ela se refere, e
// então CONFIRMAMOS DIRETO NA API DO GATEWAY (com a chave daquela academia)
// se o pagamento é real antes de dar baixa. Isso é mais seguro que um token
// fixo: ninguém consegue "inventar" um pagamento chamando esse endpoint,
// porque a gente sempre pergunta pro Asaas/Mercado Pago de verdade.
// ----------------------------------------------------------------------------

// POST /api/webhooks/mercadopago
// Configure essa URL no painel do Mercado Pago de CADA academia (Webhooks).
// Não passa pelo authMiddleware (o Mercado Pago não manda token de login).
router.post('/mercadopago', async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query['data.id'];
    if (!paymentId) return res.status(200).send('ok'); // notificação sem id, ignora

    const { data: mensalidade, error: erroBusca } = await supabaseAdmin
      .from('mensalidades')
      .select('id, academia_id, status')
      .eq('gateway_payment_id', String(paymentId))
      .maybeSingle();
    if (erroBusca) throw erroBusca;
    if (!mensalidade) return res.status(200).send('ok'); // não é uma cobrança nossa

    const { mpCred } = await gatewayPagamento.obterCredenciais(mensalidade.academia_id);
    const pagamento = await mercadoPago.consultarPagamento(mpCred, paymentId);

    if (pagamento.status === 'approved' && mensalidade.status !== 'pago') {
      await mensalidadeService.darBaixaManual({ mensalidadeId: mensalidade.id, formaPagamentoId: null, registradoPor: null });
    }
    await supabaseAdmin.from('mensalidades').update({ gateway_status: pagamento.status }).eq('id', mensalidade.id);

    res.status(200).send('ok');
  } catch (err) {
    console.error('Erro no webhook do Mercado Pago:', err);
    // Responde 200 mesmo em erro interno pra ele não ficar reenviando sem parar;
    // o erro já foi logado para investigação.
    res.status(200).send('erro processado');
  }
});

// POST /api/webhooks/asaas
// Configure essa URL no painel do Asaas de CADA academia (Integrações -> Webhooks).
router.post('/asaas', async (req, res) => {
  try {
    const evento = req.body?.event;
    const cobranca = req.body?.payment;
    if (!cobranca?.id) return res.status(200).send('ok');

    // Acha a mensalidade pelo externalReference (salvo na criação da cobrança)
    // ou, se não vier, pelo id da cobrança já salvo antes.
    let mensalidade = null;
    if (cobranca.externalReference) {
      const { data, error: erroBusca } = await supabaseAdmin
        .from('mensalidades')
        .select('id, academia_id, status')
        .eq('id', cobranca.externalReference)
        .maybeSingle();
      if (erroBusca) throw erroBusca;
      mensalidade = data;
    }
    if (!mensalidade) {
      const { data, error: erroBusca } = await supabaseAdmin
        .from('mensalidades')
        .select('id, academia_id, status')
        .eq('gateway_payment_id', String(cobranca.id))
        .maybeSingle();
      if (erroBusca) throw erroBusca;
      mensalidade = data;
    }
    if (!mensalidade) return res.status(200).send('ok'); // não é uma cobrança nossa

    // Confirma direto na API do Asaas com a chave DESSA academia, em vez de
    // confiar cegamente no que o corpo do webhook mandou.
    const { asaasCred } = await gatewayPagamento.obterCredenciais(mensalidade.academia_id);
    const cobrancaReal = await asaas.consultarCobranca(asaasCred, cobranca.id);
    const pago = ['CONFIRMED', 'RECEIVED'].includes(cobrancaReal.gateway_status);

    if (pago && mensalidade.status !== 'pago') {
      await mensalidadeService.darBaixaManual({ mensalidadeId: mensalidade.id, formaPagamentoId: null, registradoPor: null });
    }
    await supabaseAdmin.from('mensalidades').update({ gateway_status: cobrancaReal.gateway_status }).eq('id', mensalidade.id);

    res.status(200).send('ok');
  } catch (err) {
    console.error('Erro no webhook do Asaas:', err);
    res.status(200).send('erro processado');
  }
});

module.exports = router;
