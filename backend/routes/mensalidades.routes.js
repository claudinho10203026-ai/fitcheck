const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireModulo } = require('../middleware/authorize');
const mensalidadeService = require('../services/mensalidadeService');
const gateway = require('../services/gatewayPagamento');

const router = express.Router();

// GET /api/mensalidades?status=atrasado&aluno_id=...
router.get('/', requireModulo('mensalidades', 'visualizar'), async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    await mensalidadeService.atualizarAtrasadas(academiaId);

    const { status, aluno_id } = req.query;
    let query = supabaseAdmin
      .from('mensalidades')
      .select('*, alunos(nome, cpf, telefone), formas_pagamento(nome)')
      .eq('academia_id', academiaId)
      .order('data_vencimento', { ascending: true });

    if (status) query = query.eq('status', status);
    if (aluno_id) query = query.eq('aluno_id', aluno_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar mensalidades.' });
  }
});

// GET /api/mensalidades/gateway/status - qual gateway está ativo agora (pra UI decidir o que mostrar)
router.get('/gateway/status', requireModulo('mensalidades', 'visualizar'), async (req, res) => {
  const academiaId = req.funcionario.academia_id;
  res.json({
    provedor: await gateway.provedorAtivo(academiaId),
    configurado: await gateway.gatewayConfigurado(academiaId),
  });
});

// POST /api/mensalidades/gerar-carne - tela de "criação de carnê/boleto"
router.post('/gerar-carne', requireModulo('mensalidades', 'gerenciar'), async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    const { aluno_id, matricula_id, valor_parcela, numero_parcelas, primeiro_vencimento, dia_vencimento_fixo } =
      req.body;

    if (!aluno_id || !matricula_id || !valor_parcela || !numero_parcelas || !primeiro_vencimento) {
      return res.status(400).json({ erro: 'Dados incompletos para gerar o carnê.' });
    }

    const { data: matricula } = await supabaseAdmin
      .from('matriculas')
      .select('id, aluno_id')
      .eq('id', matricula_id)
      .eq('aluno_id', aluno_id)
      .eq('academia_id', academiaId)
      .maybeSingle();
    if (!matricula) {
      return res.status(404).json({ erro: 'Aluno ou matrícula não encontrados nesta academia.' });
    }

    const parcelas = await mensalidadeService.gerarCarne({
      academiaId,
      alunoId: aluno_id,
      matriculaId: matricula_id,
      valorParcela: valor_parcela,
      numeroParcelas: numero_parcelas,
      primeiroVencimento: primeiro_vencimento,
      diaVencimentoFixo: dia_vencimento_fixo,
    });

    res.status(201).json(parcelas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar carnê de mensalidades.' });
  }
});

// PUT /api/mensalidades/:id/baixa - dar baixa manual
router.put('/:id/baixa', requireModulo('mensalidades', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { forma_pagamento_id } = req.body;
    const academiaId = req.funcionario.academia_id;

    const { data: pertence } = await supabaseAdmin
      .from('mensalidades')
      .select('id')
      .eq('id', id)
      .eq('academia_id', academiaId)
      .maybeSingle();
    if (!pertence) return res.status(404).json({ erro: 'Mensalidade não encontrada.' });

    const mensalidade = await mensalidadeService.darBaixaManual({
      mensalidadeId: id,
      formaPagamentoId: forma_pagamento_id,
      registradoPor: req.funcionario.id,
    });

    res.json(mensalidade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao dar baixa na mensalidade.' });
  }
});

// Busca a mensalidade + aluno, já validando que pertence à academia do funcionário logado.
async function buscarMensalidadeDaAcademia(id, academiaId) {
  const { data, error } = await supabaseAdmin
    .from('mensalidades')
    .select('*, alunos(id, nome, email, cpf, telefone, cep, asaas_customer_id)')
    .eq('id', id)
    .eq('academia_id', academiaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// POST /api/mensalidades/:id/gateway/boleto - gera um boleto de verdade (Asaas ou Mercado Pago, o que estiver configurado)
router.post('/:id/gateway/boleto', requireModulo('mensalidades', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const academiaId = req.funcionario.academia_id;

    const mensalidade = await buscarMensalidadeDaAcademia(id, academiaId);
    if (!mensalidade) return res.status(404).json({ erro: 'Mensalidade não encontrada.' });
    if (!(await gateway.gatewayConfigurado(academiaId))) {
      return res.status(400).json({ erro: 'Nenhum gateway de pagamento configurado. Configure em Configurações > Pagamento.' });
    }

    const resultado = await gateway.gerarBoleto(academiaId, {
      aluno: mensalidade.alunos,
      valor: mensalidade.valor,
      descricao: `Mensalidade ${mensalidade.numero_parcela}/${mensalidade.total_parcelas}`,
      dataVencimento: mensalidade.data_vencimento,
      referenciaExterna: mensalidade.id,
    });

    const { data: atualizado, error: erroUpdate } = await supabaseAdmin
      .from('mensalidades')
      .update({
        gateway_provider: resultado.gateway_provider,
        gateway_payment_id: resultado.gateway_payment_id,
        gateway_status: resultado.gateway_status,
        gateway_boleto_url: resultado.gateway_boleto_url,
        gateway_linha_digitavel: resultado.gateway_linha_digitavel,
      })
      .eq('id', id)
      .select()
      .single();
    if (erroUpdate) throw erroUpdate;

    res.json(atualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message || 'Erro ao gerar boleto no gateway de pagamento.' });
  }
});

// POST /api/mensalidades/:id/gateway/pix - gera cobrança PIX de verdade, com QR code
router.post('/:id/gateway/pix', requireModulo('mensalidades', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const academiaId = req.funcionario.academia_id;

    const mensalidade = await buscarMensalidadeDaAcademia(id, academiaId);
    if (!mensalidade) return res.status(404).json({ erro: 'Mensalidade não encontrada.' });
    if (!(await gateway.gatewayConfigurado(academiaId))) {
      return res.status(400).json({ erro: 'Nenhum gateway de pagamento configurado. Configure em Configurações > Pagamento.' });
    }

    const resultado = await gateway.gerarPix(academiaId, {
      aluno: mensalidade.alunos,
      valor: mensalidade.valor,
      descricao: `Mensalidade ${mensalidade.numero_parcela}/${mensalidade.total_parcelas}`,
      dataVencimento: mensalidade.data_vencimento,
      referenciaExterna: mensalidade.id,
    });

    const { data: atualizado, error: erroUpdate } = await supabaseAdmin
      .from('mensalidades')
      .update({
        gateway_provider: resultado.gateway_provider,
        gateway_payment_id: resultado.gateway_payment_id,
        gateway_status: resultado.gateway_status,
        gateway_link: resultado.gateway_link,
      })
      .eq('id', id)
      .select()
      .single();
    if (erroUpdate) throw erroUpdate;

    res.json({ ...atualizado, qr_code_base64: resultado.qr_code_base64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message || 'Erro ao gerar PIX no gateway de pagamento.' });
  }
});

// POST /api/mensalidades/:id/gateway/cartao - cobrança de cartão de crédito (hoje só via Asaas)
router.post('/:id/gateway/cartao', requireModulo('mensalidades', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const academiaId = req.funcionario.academia_id;
    const { cartao, titular } = req.body;

    if (!cartao?.numero || !cartao?.mesValidade || !cartao?.anoValidade || !cartao?.codigoSeguranca || !titular?.cpf) {
      return res.status(400).json({ erro: 'Dados do cartão e do titular são obrigatórios.' });
    }

    const mensalidade = await buscarMensalidadeDaAcademia(id, academiaId);
    if (!mensalidade) return res.status(404).json({ erro: 'Mensalidade não encontrada.' });

    const resultado = await gateway.gerarCobrancaCartao(academiaId, {
      aluno: mensalidade.alunos,
      valor: mensalidade.valor,
      descricao: `Mensalidade ${mensalidade.numero_parcela}/${mensalidade.total_parcelas}`,
      referenciaExterna: mensalidade.id,
      cartao,
      titular,
    });

    const statusPago = ['CONFIRMED', 'RECEIVED'].includes(resultado.gateway_status);

    const { data: atualizado, error: erroUpdate } = await supabaseAdmin
      .from('mensalidades')
      .update({
        gateway_provider: resultado.gateway_provider,
        gateway_payment_id: resultado.gateway_payment_id,
        gateway_status: resultado.gateway_status,
        ...(statusPago
          ? { status: 'pago', data_pagamento: new Date().toISOString(), baixa_manual: false }
          : {}),
      })
      .eq('id', id)
      .select()
      .single();
    if (erroUpdate) throw erroUpdate;

    res.json(atualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message || 'Erro ao processar cartão de crédito.' });
  }
});

// GET /api/mensalidades/:id/gateway/pix-qrcode - recupera de novo o QR code de um PIX já gerado
router.get('/:id/gateway/pix-qrcode', requireModulo('mensalidades', 'visualizar'), async (req, res) => {
  try {
    const { id } = req.params;
    const mensalidade = await buscarMensalidadeDaAcademia(id, req.funcionario.academia_id);
    if (!mensalidade?.gateway_payment_id) return res.status(404).json({ erro: 'Nenhuma cobrança PIX gerada para essa mensalidade.' });

    const qr = await gateway.buscarPixQrCode(req.funcionario.academia_id, mensalidade.gateway_provider, mensalidade.gateway_payment_id);
    res.json(qr);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message || 'Erro ao buscar QR code.' });
  }
});

// GET /api/mensalidades/:id/gateway/status - consulta o status atual no gateway (polling) e já dá baixa se pago
router.get('/:id/gateway/status', requireModulo('mensalidades', 'visualizar'), async (req, res) => {
  try {
    const { id } = req.params;
    const academiaId = req.funcionario.academia_id;
    const mensalidade = await buscarMensalidadeDaAcademia(id, academiaId);
    if (!mensalidade?.gateway_payment_id) return res.status(404).json({ erro: 'Sem cobrança de gateway para essa mensalidade.' });

    if (mensalidade.status === 'pago') return res.json({ status: 'pago' });

    const resultado = await gateway.consultarCobranca(academiaId, mensalidade.gateway_provider, mensalidade.gateway_payment_id);
    const pago = ['CONFIRMED', 'RECEIVED', 'approved'].includes(resultado.gateway_status);

    if (pago) {
      await mensalidadeService.darBaixaManual({
        mensalidadeId: id,
        formaPagamentoId: null,
        registradoPor: req.funcionario.id,
      });
      await supabaseAdmin.from('mensalidades').update({ gateway_status: resultado.gateway_status }).eq('id', id);
      return res.json({ status: 'pago' });
    }

    await supabaseAdmin.from('mensalidades').update({ gateway_status: resultado.gateway_status }).eq('id', id);
    res.json({ status: 'aguardando' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message || 'Erro ao consultar status do pagamento.' });
  }
});

module.exports = router;
