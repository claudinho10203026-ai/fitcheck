const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireModulo } = require('../middleware/authorize');

const router = express.Router();

// GET /api/matriculas?status=pendente
router.get('/', requireModulo('matriculas', 'visualizar'), async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabaseAdmin
      .from('matriculas')
      .select('*, alunos(nome, cpf, telefone), planos(nome, valor, duracao_meses)')
      .eq('academia_id', req.funcionario.academia_id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar matrículas.' });
  }
});

// POST /api/matriculas - cria (fica "pendente" até liberação)
router.post('/', requireModulo('matriculas', 'gerenciar'), async (req, res) => {
  try {
    const { aluno_id, plano_id, data_inicio, observacoes } = req.body;
    const academiaId = req.funcionario.academia_id;
    if (!aluno_id || !plano_id) {
      return res.status(400).json({ erro: 'Aluno e plano são obrigatórios.' });
    }

    // Confere que o aluno e o plano pertencem à mesma academia do funcionário
    // logado (evita que alguém referencie IDs de outra academia).
    const [{ data: aluno }, { data: plano }] = await Promise.all([
      supabaseAdmin.from('alunos').select('id').eq('id', aluno_id).eq('academia_id', academiaId).maybeSingle(),
      supabaseAdmin.from('planos').select('id').eq('id', plano_id).eq('academia_id', academiaId).maybeSingle(),
    ]);
    if (!aluno || !plano) {
      return res.status(404).json({ erro: 'Aluno ou plano não encontrado nesta academia.' });
    }

    const { data, error } = await supabaseAdmin
      .from('matriculas')
      .insert({ aluno_id, plano_id, data_inicio, observacoes, status: 'pendente', academia_id: academiaId })
      .select('*, alunos(nome), planos(nome, valor, duracao_meses)')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar matrícula.' });
  }
});

// PUT /api/matriculas/:id/liberar
router.put('/:id/liberar', requireModulo('matriculas', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const academiaId = req.funcionario.academia_id;
    const liberadaPor = req.funcionario.id;

    const { data: matricula, error: erroBusca } = await supabaseAdmin
      .from('matriculas')
      .select('*, planos(duracao_meses)')
      .eq('id', id)
      .eq('academia_id', academiaId)
      .maybeSingle();
    if (erroBusca) throw erroBusca;
    if (!matricula) return res.status(404).json({ erro: 'Matrícula não encontrada.' });

    const dataInicio = new Date(`${matricula.data_inicio}T00:00:00`);
    const dataFim = new Date(dataInicio);
    dataFim.setMonth(dataFim.getMonth() + (matricula.planos?.duracao_meses || 1));

    const { data, error } = await supabaseAdmin
      .from('matriculas')
      .update({
        status: 'ativa',
        liberada_por: liberadaPor,
        liberada_em: new Date().toISOString(),
        data_fim: dataFim.toISOString().slice(0, 10),
      })
      .eq('id', id)
      .eq('academia_id', academiaId)
      .select('*, alunos(nome), planos(nome, valor, duracao_meses)')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao liberar matrícula.' });
  }
});

// PUT /api/matriculas/:id/status - suspende/cancela/reativa
router.put('/:id/status', requireModulo('matriculas', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['suspensa', 'cancelada', 'ativa'].includes(status)) {
      return res.status(400).json({ erro: 'Status inválido.' });
    }

    const { data, error } = await supabaseAdmin
      .from('matriculas')
      .update({ status })
      .eq('id', id)
      .eq('academia_id', req.funcionario.academia_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar status da matrícula.' });
  }
});

module.exports = router;
