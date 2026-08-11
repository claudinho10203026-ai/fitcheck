const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireModulo } = require('../middleware/authorize');

const router = express.Router();

router.use(requireModulo('agendamentos', 'visualizar'));

// GET /api/agendamentos?data=2026-07-25&funcionario_id=...
// Lista agendamentos de um dia (usado na agenda). Sem "data", usa hoje.
router.get('/', async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    const data = req.query.data || new Date().toISOString().slice(0, 10);

    let query = supabaseAdmin
      .from('agendamentos')
      .select('*, alunos(id, nome, telefone, foto_url), funcionarios!agendamentos_funcionario_id_fkey(nome, especialidade)')
      .eq('academia_id', academiaId)
      .eq('data', data)
      .order('hora_inicio', { ascending: true });

    if (req.query.funcionario_id) query = query.eq('funcionario_id', req.query.funcionario_id);

    const { data: agendamentos, error } = await query;
    if (error) throw error;
    res.json(agendamentos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar agendamentos.' });
  }
});

// GET /api/agendamentos/profissionais - funcionários marcados como agendáveis
router.get('/profissionais', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('funcionarios')
      .select('id, nome, especialidade')
      .eq('academia_id', req.funcionario.academia_id)
      .eq('agendavel', true)
      .eq('ativo', true)
      .order('nome');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar profissionais.' });
  }
});

// Verifica se já existe agendamento conflitante (mesmo profissional, mesmo
// dia, horário sobreposto), ignorando os cancelados.
async function existeConflito({ academiaId, funcionarioId, data, horaInicio, horaFim, ignorarId }) {
  let query = supabaseAdmin
    .from('agendamentos')
    .select('id')
    .eq('academia_id', academiaId)
    .eq('funcionario_id', funcionarioId)
    .eq('data', data)
    .neq('status', 'cancelado')
    .lt('hora_inicio', horaFim)
    .gt('hora_fim', horaInicio);

  if (ignorarId) query = query.neq('id', ignorarId);

  const { data: conflitos, error } = await query;
  if (error) throw error;
  return conflitos.length > 0;
}

// POST /api/agendamentos - cria um novo agendamento
router.post('/', requireModulo('agendamentos', 'gerenciar'), async (req, res) => {
  try {
    const academiaId = req.funcionario.academia_id;
    const { aluno_id, funcionario_id, data, hora_inicio, hora_fim, servico, observacoes } = req.body;

    if (!aluno_id || !funcionario_id || !data || !hora_inicio || !hora_fim) {
      return res.status(400).json({ erro: 'Aluno, profissional, data e horário são obrigatórios.' });
    }
    if (hora_fim <= hora_inicio) {
      return res.status(400).json({ erro: 'O horário final precisa ser depois do horário inicial.' });
    }

    // confere que aluno e profissional pertencem a essa academia
    const [{ data: aluno }, { data: profissional }] = await Promise.all([
      supabaseAdmin.from('alunos').select('id').eq('id', aluno_id).eq('academia_id', academiaId).maybeSingle(),
      supabaseAdmin.from('funcionarios').select('id').eq('id', funcionario_id).eq('academia_id', academiaId).maybeSingle(),
    ]);
    if (!aluno || !profissional) {
      return res.status(404).json({ erro: 'Aluno ou profissional não encontrado nesta academia.' });
    }

    if (await existeConflito({ academiaId, funcionarioId: funcionario_id, data, horaInicio: hora_inicio, horaFim: hora_fim })) {
      return res.status(409).json({ erro: 'Esse profissional já tem um agendamento nesse horário.' });
    }

    const { data: novo, error } = await supabaseAdmin
      .from('agendamentos')
      .insert({
        academia_id: academiaId,
        aluno_id,
        funcionario_id,
        data,
        hora_inicio,
        hora_fim,
        servico,
        observacoes,
        criado_por: req.funcionario.id,
      })
      .select('*, alunos(nome), funcionarios!agendamentos_funcionario_id_fkey(nome)')
      .single();

    if (error) throw error;
    res.status(201).json(novo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar agendamento.' });
  }
});

// PUT /api/agendamentos/:id - reagendar (data/horário/profissional)
router.put('/:id', requireModulo('agendamentos', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const academiaId = req.funcionario.academia_id;
    const { data, hora_inicio, hora_fim, funcionario_id, servico, observacoes } = req.body;

    const { data: atual } = await supabaseAdmin
      .from('agendamentos')
      .select('*')
      .eq('id', id)
      .eq('academia_id', academiaId)
      .maybeSingle();
    if (!atual) return res.status(404).json({ erro: 'Agendamento não encontrado.' });

    const novoFuncionario = funcionario_id || atual.funcionario_id;
    const novaData = data || atual.data;
    const novaHoraInicio = hora_inicio || atual.hora_inicio;
    const novaHoraFim = hora_fim || atual.hora_fim;

    if (
      await existeConflito({
        academiaId,
        funcionarioId: novoFuncionario,
        data: novaData,
        horaInicio: novaHoraInicio,
        horaFim: novaHoraFim,
        ignorarId: id,
      })
    ) {
      return res.status(409).json({ erro: 'Esse profissional já tem um agendamento nesse horário.' });
    }

    const { data: atualizado, error } = await supabaseAdmin
      .from('agendamentos')
      .update({
        funcionario_id: novoFuncionario,
        data: novaData,
        hora_inicio: novaHoraInicio,
        hora_fim: novaHoraFim,
        servico,
        observacoes,
      })
      .eq('id', id)
      .eq('academia_id', academiaId)
      .select('*, alunos(nome), funcionarios!agendamentos_funcionario_id_fkey(nome)')
      .single();

    if (error) throw error;
    res.json(atualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao reagendar.' });
  }
});

// PUT /api/agendamentos/:id/status - cancelar / marcar realizado / marcar falta
router.put('/:id/status', requireModulo('agendamentos', 'gerenciar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['confirmado', 'cancelado', 'realizado', 'falta'].includes(status)) {
      return res.status(400).json({ erro: 'Status inválido.' });
    }

    const { data, error } = await supabaseAdmin
      .from('agendamentos')
      .update({ status })
      .eq('id', id)
      .eq('academia_id', req.funcionario.academia_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar status do agendamento.' });
  }
});

module.exports = router;
