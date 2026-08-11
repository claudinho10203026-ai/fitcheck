const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const mercadoPago = require('../services/mercadoPagoService');
const mensalidadeService = require('../services/mensalidadeService');

const router = express.Router();

// POST /api/webhooks/mercadopago
// Configure essa URL no painel do Mercado Pago (Webhooks) para receber
// notificações automáticas quando um boleto/PIX for pago.
// Essa rota NÃO passa pelo authMiddleware (o Mercado Pago não manda token de login).
router.post('/mercadopago', async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query['data.id'];
    if (!paymentId) return res.status(200).send('ok'); // ignora notificações sem id

    const pagamento = await mercadoPago.consultarPagamento(paymentId);

    if (pagamento.status === 'approved') {
      await supabaseAdmin
        .from('mensalidades')
        .update({
          status: 'pago',
          data_pagamento: new Date().toISOString(),
          gateway_status: pagamento.status,
        })
        .eq('gateway_payment_id', String(paymentId));
    } else {
      await supabaseAdmin
        .from('mensalidades')
        .update({ gateway_status: pagamento.status })
        .eq('gateway_payment_id', String(paymentId));
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('Erro no webhook do Mercado Pago:', err);
    // Responde 200 mesmo em erro interno para o Mercado Pago não ficar reenviando
    // indefinidamente; o erro já foi logado para investigação.
    res.status(200).send('erro processado');
  }
});

// POST /api/webhooks/asaas
// Configure essa URL no painel do Asaas (Integrações -> Webhooks), com o mesmo
// token que você colocar em ASAAS_WEBHOOK_TOKEN no .env do backend - o Asaas
// manda esse token de volta no header abaixo, o que prova que a chamada é
// legítima (e não alguém tentando marcar mensalidades como pagas na mão).
router.post('/asaas', async (req, res) => {
  try {
    if (process.env.ASAAS_WEBHOOK_TOKEN) {
      const tokenRecebido = req.headers['asaas-access-token'];
      if (tokenRecebido !== process.env.ASAAS_WEBHOOK_TOKEN) {
        return res.status(401).send('token inválido');
      }
    }

    const evento = req.body?.event;
    const cobranca = req.body?.payment;
    if (!cobranca?.id) return res.status(200).send('ok');

    const eventosDePagamentoConfirmado = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];

    if (eventosDePagamentoConfirmado.includes(evento)) {
      // externalReference foi salvo como o id da nossa própria mensalidade
      // na hora de criar a cobrança (ver services/asaasService.js).
      const mensalidadeId = cobranca.externalReference;
      if (mensalidadeId) {
        await mensalidadeService.darBaixaManual({ mensalidadeId, formaPagamentoId: null, registradoPor: null });
      } else {
        await supabaseAdmin
          .from('mensalidades')
          .update({ status: 'pago', data_pagamento: new Date().toISOString(), gateway_status: cobranca.status })
          .eq('gateway_payment_id', String(cobranca.id));
      }
    } else {
      await supabaseAdmin
        .from('mensalidades')
        .update({ gateway_status: cobranca.status })
        .eq('gateway_payment_id', String(cobranca.id));
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('Erro no webhook do Asaas:', err);
    res.status(200).send('erro processado');
  }
});

module.exports = router;
