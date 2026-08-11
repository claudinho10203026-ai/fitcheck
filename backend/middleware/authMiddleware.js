const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabaseClient');

// Protege as rotas: exige um token JWT válido (emitido por /api/auth/login)
// no header Authorization: Bearer <token>.
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ erro: 'Token de autenticação não informado.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ erro: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    const { data: funcionario, error } = await supabaseAdmin
      .from('funcionarios')
      .select('id, academia_id, nome, usuario, tipo, permissoes, ativo, academias(nome)')
      .eq('id', payload.funcionario_id)
      .maybeSingle();

    if (error || !funcionario || !funcionario.ativo) {
      return res.status(401).json({ erro: 'Conta inválida, desativada ou não encontrada.' });
    }

    req.funcionario = funcionario;
    next();
  } catch (err) {
    console.error('Erro no authMiddleware:', err);
    res.status(500).json({ erro: 'Erro ao validar autenticação.' });
  }
}

module.exports = { requireAuth };
