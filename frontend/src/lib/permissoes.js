// Espelha a mesma lógica de backend/middleware/authorize.js (NIVEIS/MODULOS),
// para o frontend decidir o que mostrar/esconder na interface. A permissão
// "de verdade" é sempre reforçada pelo backend - isto aqui é só pra UX.
export const NIVEIS = { nenhum: 0, visualizar: 1, gerenciar: 2 };
export const MODULOS = ['alunos', 'matriculas', 'mensalidades', 'caixa', 'relatorios', 'agendamentos', 'acesso'];

export function temPermissao(funcionario, modulo, nivelMinimo = 'visualizar') {
  if (!funcionario) return false;
  if (funcionario.tipo === 'admin') return true;
  const nivelAtual = funcionario.permissoes?.[modulo] || 'nenhum';
  return NIVEIS[nivelAtual] >= NIVEIS[nivelMinimo];
}
