const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireAdmin } = require('../middleware/authorize');

const router = express.Router();

// GET /api/planos - leitura liberada a qualquer funcionário autenticado
// (é dado de referência usado em formulários de matrícula/carnê)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('planos')
      .select('*')
      .eq('academia_id', req.funcionario.academia_id)
      .order('valor', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar planos.' });
  }
});

// POST/PUT são ação administrativa (definem os preços da academia)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const payload = { ...req.body, academia_id: req.funcionario.academia_id };
    const { data, error } = await supabaseAdmin.from('planos').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar plano.' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { academia_id, ...atualizacoes } = req.body;
    const { data, error } = await supabaseAdmin
      .from('planos')
      .update(atualizacoes)
      .eq('id', id)
      .eq('academia_id', req.funcionario.academia_id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar plano.' });
  }
});

module.exports = router;
