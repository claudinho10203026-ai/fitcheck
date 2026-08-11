// Ordem de "força" de cada nível de permissão, usada para comparar
// (ex: quem tem 'gerenciar' também atende a uma exigência de 'visualizar').
const NIVEIS = { nenhum: 0, visualizar: 1, gerenciar: 2 };

// Lista das telas que podem ter permissão configurada por funcionário.
// Dashboard não entra aqui (sempre visível); Funcionários é sempre admin-only.
const MODULOS = ['alunos', 'matriculas', 'mensalidades', 'caixa', 'relatorios', 'agendamentos', 'acesso'];

/**
 * Middleware de fábrica: exige que o funcionário logado tenha, no mínimo,
 * o nível `nivelMinimo` no módulo `modulo`. Admin sempre passa.
 */
function requireModulo(modulo, nivelMinimo = 'visualizar') {
  return (req, res, next) => {
    if (req.funcionario.tipo === 'admin') return next();

    const nivelAtual = req.funcionario.permissoes?.[modulo] || 'nenhum';
    if (NIVEIS[nivelAtual] >= NIVEIS[nivelMinimo]) return next();

    return res.status(403).json({ erro: 'Você não tem permissão para acessar essa área.' });
  };
}

/** Exige que o funcionário logado seja admin da academia. */
function requireAdmin(req, res, next) {
  if (req.funcionario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Apenas administradores podem fazer isso.' });
  }
  next();
}

/** Garante que um objeto de permissões só contenha módulos/níveis válidos. */
function sanitizarPermissoes(permissoes = {}) {
  const limpo = {};
  for (const modulo of MODULOS) {
    const nivel = permissoes?.[modulo];
    limpo[modulo] = ['visualizar', 'gerenciar'].includes(nivel) ? nivel : 'nenhum';
  }
  return limpo;
}

module.exports = { requireModulo, requireAdmin, sanitizarPermissoes, MODULOS, NIVEIS };
