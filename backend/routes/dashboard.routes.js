const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const mensalidadeService = require('../services/mensalidadeService');

const router = express.Router();

// Dashboard não tem permissão configurável por tela - qualquer funcionário
// autenticado (admin ou membro) vê o resumo da própria academia.

// GET /api/dashboard/resumo
router.get('/resumo', async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    await mensalidadeService.atualizarAtrasadas(academiaId);

    const [alunosAtivos, mensalidadesAtrasadas, mensalidadesEmAberto, mensalidadesPagasMes, caixaAberto] =
      await Promise.all([
        supabaseAdmin
          .from('alunos')
          .select('id', { count: 'exact', head: true })
          .eq('academia_id', academiaId)
          .eq('status', 'ativo'),
        supabaseAdmin.from('mensalidades').select('valor').eq('academia_id', academiaId).eq('status', 'atrasado'),
        supabaseAdmin.from('mensalidades').select('valor').eq('academia_id', academiaId).eq('status', 'em_aberto'),
        supabaseAdmin
          .from('mensalidades')
          .select('valor')
          .eq('academia_id', academiaId)
          .eq('status', 'pago')
          .gte('data_pagamento', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabaseAdmin
          .from('caixa_sessoes')
          .select('id, valor_abertura')
          .eq('academia_id', academiaId)
          .eq('status', 'aberto')
          .maybeSingle(),
      ]);

    const somaValores = (arr) => (arr || []).reduce((s, m) => s + Number(m.valor), 0);
    const totalMensalidades =
      (mensalidadesAtrasadas.data?.length || 0) +
      (mensalidadesEmAberto.data?.length || 0) +
      (mensalidadesPagasMes.data?.length || 0);

    let totalCaixaHoje = 0;
    if (caixaAberto.data) {
      const { data: movs } = await supabaseAdmin
        .from('caixa_movimentacoes')
        .select('tipo, valor')
        .eq('caixa_sessao_id', caixaAberto.data.id);
      const entradas = (movs || []).filter((m) => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
      const saidas = (movs || []).filter((m) => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
      totalCaixaHoje = Number(caixaAberto.data.valor_abertura) + entradas - saidas;
    }

    res.json({
      alunos_ativos: alunosAtivos.count || 0,
      valor_atrasado: somaValores(mensalidadesAtrasadas.data),
      qtd_atrasadas: mensalidadesAtrasadas.data?.length || 0,
      valor_em_aberto: somaValores(mensalidadesEmAberto.data),
      qtd_em_aberto: mensalidadesEmAberto.data?.length || 0,
      valor_recebido_mes: somaValores(mensalidadesPagasMes.data),
      qtd_pagas_mes: mensalidadesPagasMes.data?.length || 0,
      taxa_adimplencia:
        totalMensalidades > 0
          ? Math.round(((mensalidadesPagasMes.data?.length || 0) / totalMensalidades) * 100)
          : 100,
      caixa_aberto: Boolean(caixaAberto.data),
      total_caixa_hoje: totalCaixaHoje,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar resumo do dashboard.' });
  }
});

// GET /api/dashboard/inadimplencia
router.get('/inadimplencia', async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    await mensalidadeService.atualizarAtrasadas(academiaId);

    const { data, error } = await supabaseAdmin
      .from('mensalidades')
      .select('*, alunos(id, nome, cpf, telefone, email)')
      .eq('academia_id', academiaId)
      .eq('status', 'atrasado')
      .order('data_vencimento', { ascending: true });

    if (error) throw error;

    const hoje = new Date();
    const relatorio = data.map((m) => {
      const vencimento = new Date(`${m.data_vencimento}T00:00:00`);
      const diasAtraso = Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24));
      return { ...m, dias_atraso: diasAtraso };
    });

    res.json(relatorio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar relatório de inadimplência.' });
  }
});

module.exports = router;
