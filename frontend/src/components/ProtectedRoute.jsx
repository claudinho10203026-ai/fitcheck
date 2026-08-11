import { Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { temPermissao } from '../lib/permissoes';

function AcessoNegado() {
  return (
    <div className="h-full flex flex-col items-center justify-center py-24 text-center">
      <ShieldAlert className="text-steel-600 mb-3" size={32} />
      <p className="text-steel-300 font-medium">Você não tem permissão para acessar esta tela.</p>
      <p className="text-steel-500 text-sm mt-1">Fale com o administrador da academia se precisar de acesso.</p>
    </div>
  );
}

/**
 * Protege uma rota exigindo login e, opcionalmente, uma permissão mínima.
 * - modulo: nome do módulo (ex: 'alunos'). Se omitido, só exige estar logado.
 * - nivel: nível mínimo exigido ('visualizar' ou 'gerenciar').
 * - soAdmin: se true, exige que o funcionário seja admin da academia.
 */
export default function ProtectedRoute({ children, modulo, nivel = 'visualizar', soAdmin = false }) {
  const { autenticado, carregando, funcionario } = useAuth();

  if (carregando) {
    return (
      <div className="h-screen flex items-center justify-center bg-graphite-950">
        <div className="h-8 w-8 rounded-full border-2 border-ember-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!autenticado) {
    return <Navigate to="/login" replace />;
  }

  if (soAdmin && funcionario?.tipo !== 'admin') {
    return <AcessoNegado />;
  }

  if (modulo && !temPermissao(funcionario, modulo, nivel)) {
    return <AcessoNegado />;
  }

  return children;
}
