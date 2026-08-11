const express = require('express');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireAdmin, sanitizarPermissoes } = require('../middleware/authorize');

const router = express.Router();

// Todas as rotas aqui são exclusivas de admin: só o admin cadastra membros
// e decide quais telas/permissões cada um tem.
router.use(requireAdmin);

const CAMPOS_PUBLICOS = 'id, nome, usuario, tipo, permissoes, ativo, agendavel, especialidade, created_at';

// GET /api/funcionarios
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('funcionarios')
      .select(CAMPOS_PUBLICOS)
      .eq('academia_id', req.funcionario.academia_id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar funcionários.' });
  }
});

// POST /api/funcionarios - cria um novo membro (ou outro admin)
router.post('/', async (req, res) => {
  try {
    const { nome, usuario, senha, tipo, permissoes, agendavel, especialidade } = req.body;
    if (!nome || !usuario || !senha) {
      return res.status(400).json({ erro: 'Nome, usuário e senha são obrigatórios.' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const senha_hash = await bcrypt.hash(senha, 10);

    const { data, error } = await supabaseAdmin
      .from('funcionarios')
      .insert({
        academia_id: req.funcionario.academia_id,
        nome,
        usuario: usuario.trim(),
        senha_hash,
        tipo: tipo === 'admin' ? 'admin' : 'membro',
        permissoes: sanitizarPermissoes(permissoes),
        agendavel: Boolean(agendavel),
        especialidade: especialidade || null,
      })
      .select(CAMPOS_PUBLICOS)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ erro: 'Já existe um funcionário com esse nome de usuário.' });
      }
      throw error;
    }
    res.status(201).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar funcionário.' });
  }
});

// PUT /api/funcionarios/:id - edita dados, permissões, senha ou desativa
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, senha, tipo, permissoes, ativo, agendavel, especialidade } = req.body;
    const academiaId = req.funcionario.academia_id;

    // Trava de segurança: impede remover/rebaixar/desativar o último admin ativo
    const vaiPerderAdmin = (tipo && tipo !== 'admin') || ativo === false;
    if (vaiPerderAdmin) {
      const { data: alvo } = await supabaseAdmin
        .from('funcionarios')
        .select('tipo')
        .eq('id', id)
        .eq('academia_id', academiaId)
        .maybeSingle();

      if (alvo?.tipo === 'admin') {
        const { count } = await supabaseAdmin
          .from('funcionarios')
          .select('id', { count: 'exact', head: true })
          .eq('academia_id', academiaId)
          .eq('tipo', 'admin')
          .eq('ativo', true);
        if ((count || 0) <= 1) {
          return res.status(400).json({ erro: 'Não é possível remover o último administrador da academia.' });
        }
      }
    }

    const atualizacoes = {};
    if (nome) atualizacoes.nome = nome;
    if (tipo) atualizacoes.tipo = tipo === 'admin' ? 'admin' : 'membro';
    if (permissoes) atualizacoes.permissoes = sanitizarPermissoes(permissoes);
    if (typeof ativo === 'boolean') atualizacoes.ativo = ativo;
    if (typeof agendavel === 'boolean') atualizacoes.agendavel = agendavel;
    if (especialidade !== undefined) atualizacoes.especialidade = especialidade || null;
    if (senha) {
      if (senha.length < 6) return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
      atualizacoes.senha_hash = await bcrypt.hash(senha, 10);
    }

    const { data, error } = await supabaseAdmin
      .from('funcionarios')
      .update(atualizacoes)
      .eq('id', id)
      .eq('academia_id', academiaId)
      .select(CAMPOS_PUBLICOS)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar funcionário.' });
  }
});

module.exports = router;
