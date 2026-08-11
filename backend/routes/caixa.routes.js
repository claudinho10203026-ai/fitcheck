const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireModulo } = require('../middleware/authorize');
const mensalidadeService = require('../services/mensalidadeService');

const router = express.Router();

router.use(requireModulo('caixa', 'visualizar'));

// GET /api/caixa/atual - sessão aberta da academia (se houver) + movimentações
router.get('/atual', async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;

    const { data: sessao, error } = await supabaseAdmin
      .from('caixa_sessoes')
      .select('*, funcionarios!caixa_sessoes_aberto_por_fkey(nome)')
      .eq('academia_id', academiaId)
      .eq('status', 'aberto')
      .maybeSingle();
    if (error) throw error;

    if (!sessao) return res.json({ sessao: null, movimentacoes: [] });

    const { data: movimentacoes, error: erroMov } = await supabaseAdmin
      .from('caixa_movimentacoes')
      .select('*, formas_pagamento(nome)')
      .eq('caixa_sessao_id', sessao.id)
      .order('created_at', { ascending: false });
    if (erroMov) throw erroMov;

    res.json({ sessao, movimentacoes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar caixa atual.' });
  }
});

// GET /api/caixa/historico
router.get('/historico', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('caixa_sessoes')
      .select('*, funcionarios!caixa_sessoes_aberto_por_fkey(nome)')
      .eq('academia_id', req.funcionario.academia_id)
      .eq('status', 'fechado')
      .order('data_abertura', { ascending: false })
      .limit(30);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar histórico de caixa.' });
  }
});

// GET /api/caixa/formas-pagamento (lista global, qualquer funcionário autenticado usa)
router.get('/formas-pagamento', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('formas_pagamento')
      .select('*')
      .eq('ativo', true)
      .order('nome');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar formas de pagamento.' });
  }
});

// POST /api/caixa/abrir
router.post('/abrir', requireModulo('caixa', 'gerenciar'), async (req, res) => {
  try {
    const { valor_abertura } = req.body;
    const academiaId = req.funcionario.academia_id;

    const valorAberturaNumerico = Number(valor_abertura || 0);
    if (Number.isNaN(valorAberturaNumerico) || valorAberturaNumerico < 0) {
      return res.status(400).json({ erro: 'Valor de abertura inválido.' });
    }

    const { data: jaAberto } = await supabaseAdmin
      .from('caixa_sessoes')
      .select('id')
      .eq('academia_id', academiaId)
      .eq('status', 'aberto')
      .maybeSingle();

    if (jaAberto) {
      return res.status(409).json({ erro: 'Já existe um caixa aberto para esta academia.' });
    }

    const { data, error } = await supabaseAdmin
      .from('caixa_sessoes')
      .insert({ academia_id: academiaId, valor_abertura: valorAberturaNumerico, aberto_por: req.funcionario.id })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao abrir caixa.' });
  }
});

// POST /api/caixa/:id/fechar
router.post('/:id/fechar', requireModulo('caixa', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const academiaId = req.funcionario.academia_id;
    const { valor_fechamento_informado, observacoes } = req.body;
    if (valor_fechamento_informado !== undefined && valor_fechamento_informado !== null) {
      const v = Number(valor_fechamento_informado);
      if (Number.isNaN(v) || v < 0) {
        return res.status(400).json({ erro: 'Valor de fechamento informado inválido.' });
      }
    }

    const { data: sessao, error: erroSessao } = await supabaseAdmin
      .from('caixa_sessoes')
      .select('valor_abertura')
      .eq('id', id)
      .eq('academia_id', academiaId)
      .maybeSingle();
    if (erroSessao) throw erroSessao;
    if (!sessao) return res.status(404).json({ erro: 'Sessão de caixa não encontrada.' });

    const { data: movimentacoes, error: erroMov } = await supabaseAdmin
      .from('caixa_movimentacoes')
      .select('tipo, valor')
      .eq('caixa_sessao_id', id);
    if (erroMov) throw erroMov;

    const totalEntradas = movimentacoes.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
    const totalSaidas = movimentacoes.filter((m) => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
    const valorCalculado = Number(sessao.valor_abertura) + totalEntradas - totalSaidas;

    const { data, error } = await supabaseAdmin
      .from('caixa_sessoes')
      .update({
        status: 'fechado',
        data_fechamento: new Date().toISOString(),
        valor_fechamento_informado,
        valor_fechamento_calculado: valorCalculado,
        fechado_por: req.funcionario.id,
        observacoes,
      })
      .eq('id', id)
      .eq('academia_id', academiaId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao fechar caixa.' });
  }
});

// POST /api/caixa/:id/movimentacao
router.post('/:id/movimentacao', requireModulo('caixa', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const academiaId = req.funcionario.academia_id;
    const { tipo, categoria, descricao, valor, forma_pagamento_id, mensalidade_id } = req.body;

    if (!['entrada', 'saida'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo deve ser "entrada" ou "saida".' });
    }
    const valorNumerico = Number(valor);
    if (!valor || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      return res.status(400).json({ erro: 'Informe um valor maior que zero.' });
    }
    const categoriasValidas = ['mensalidade', 'produto', 'sangria', 'suprimento', 'outro'];
    if (categoria && !categoriasValidas.includes(categoria)) {
      return res.status(400).json({ erro: 'Categoria inválida.' });
    }

    const { data: sessao } = await supabaseAdmin
      .from('caixa_sessoes')
      .select('id')
      .eq('id', id)
      .eq('academia_id', academiaId)
      .eq('status', 'aberto')
      .maybeSingle();
    if (!sessao) return res.status(404).json({ erro: 'Sessão de caixa aberta não encontrada.' });

    let mensalidadeJaPaga = false;
    if (mensalidade_id) {
      const { data: mensalidade } = await supabaseAdmin
        .from('mensalidades')
        .select('id, status')
        .eq('id', mensalidade_id)
        .eq('academia_id', academiaId)
        .maybeSingle();
      if (!mensalidade) return res.status(404).json({ erro: 'Mensalidade não encontrada nesta academia.' });
      mensalidadeJaPaga = mensalidade.status === 'pago';
    }

    const { data: movimentacao, error } = await supabaseAdmin
      .from('caixa_movimentacoes')
      .insert({
        academia_id: academiaId,
        caixa_sessao_id: id,
        tipo,
        categoria: categoria || 'outro',
        descricao,
        valor: valorNumerico,
        forma_pagamento_id,
        mensalidade_id,
        registrado_por: req.funcionario.id,
      })
      .select('*, formas_pagamento(nome)')
      .single();

    if (error) throw error;

    // Se a movimentação está ligada a uma mensalidade que ainda não estava paga,
    // dá baixa automaticamente. Se já foi paga via gateway (ex: PIX confirmado
    // antes desse registro), não sobrescreve os dados do pagamento original.
    if (mensalidade_id && !mensalidadeJaPaga) {
      await mensalidadeService.darBaixaManual({
        mensalidadeId: mensalidade_id,
        formaPagamentoId: forma_pagamento_id,
        registradoPor: req.funcionario.id,
      });
    }

    res.status(201).json(movimentacao);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar movimentação de caixa.' });
  }
});

module.exports = router;
