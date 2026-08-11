const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabaseClient');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Mensagem genérica de propósito: nunca revela se o problema foi a academia,
// o usuário ou a senha, para não dar pistas a quem tenta adivinhar credenciais.
const ERRO_LOGIN = { erro: 'Academia, usuário ou senha inválidos.' };

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { nome_academia, usuario, senha } = req.body;
    if (!nome_academia || !usuario || !senha) {
      return res.status(400).json({ erro: 'Preencha academia, usuário e senha.' });
    }

    const { data: academia } = await supabaseAdmin
      .from('academias')
      .select('id, nome')
      .ilike('nome', nome_academia.trim())
      .maybeSingle();
    if (!academia) return res.status(401).json(ERRO_LOGIN);

    const { data: funcionario } = await supabaseAdmin
      .from('funcionarios')
      .select('*')
      .eq('academia_id', academia.id)
      .ilike('usuario', usuario.trim())
      .maybeSingle();
    if (!funcionario || !funcionario.ativo) return res.status(401).json(ERRO_LOGIN);

    const senhaOk = await bcrypt.compare(senha, funcionario.senha_hash);
    if (!senhaOk) return res.status(401).json(ERRO_LOGIN);

    const token = jwt.sign(
      { funcionario_id: funcionario.id, academia_id: academia.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
        usuario: funcionario.usuario,
        tipo: funcionario.tipo,
        permissoes: funcionario.permissoes,
      },
      academia: { id: academia.id, nome: academia.nome },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao efetuar login.' });
  }
});

// GET /api/auth/me - usado pelo frontend para restaurar a sessão ao recarregar
// a página, e para pegar permissões atualizadas (caso o admin tenha alterado).
router.get('/me', requireAuth, async (req, res) => {
  const f = req.funcionario;
  res.json({
    funcionario: { id: f.id, nome: f.nome, usuario: f.usuario, tipo: f.tipo, permissoes: f.permissoes },
    academia: { id: f.academia_id, nome: f.academias?.nome },
  });
});

module.exports = router;
