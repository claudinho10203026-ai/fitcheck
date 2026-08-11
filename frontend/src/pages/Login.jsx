import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Dumbbell, Loader2, Building2, User, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { entrar, autenticado, carregando } = useAuth();
  const [nomeAcademia, setNomeAcademia] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!carregando && autenticado) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(nomeAcademia, usuario, senha);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível entrar. Confira os dados e tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  const campo = 'w-full pl-9 pr-3 py-2.5 rounded-lg bg-graphite-800 border border-graphite-700 text-white placeholder-steel-500 text-sm focus:outline-none focus:ring-2 focus:ring-ember-500 focus:border-transparent';

  return (
    <div className="min-h-screen bg-graphite-950 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute inset-x-0 h-px bg-white" style={{ top: `${(i + 1) * 14}%` }} />
        ))}
      </div>

      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-ember-500 flex items-center justify-center mb-4">
            <Dumbbell className="text-white" size={24} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">Sistema Academia</h1>
          <p className="text-steel-400 text-sm mt-1">Entre com sua conta de funcionário</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-graphite-900 border border-graphite-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-steel-300 mb-1.5">Nome da academia</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" size={16} />
              <input
                required
                autoFocus
                value={nomeAcademia}
                onChange={(e) => setNomeAcademia(e.target.value)}
                placeholder="Academia Exemplo"
                className={campo}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-steel-300 mb-1.5">Usuário</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" size={16} />
              <input
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="seu.usuario"
                className={campo}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-steel-300 mb-1.5">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" size={16} />
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className={campo}
              />
            </div>
          </div>

          {erro && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full flex items-center justify-center gap-2 bg-ember-500 hover:bg-ember-600 disabled:opacity-60 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
          >
            {enviando && <Loader2 size={16} className="animate-spin" />}
            Entrar
          </button>
        </form>

        <p className="text-center text-steel-500 text-xs mt-6">
          Acesso restrito à equipe da academia. Contate o administrador para criar sua conta.
        </p>
      </div>
    </div>
  );
}
