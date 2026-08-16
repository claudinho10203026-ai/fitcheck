import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Receipt,
  Wallet,
  BarChart3,
  CalendarClock,
  UserCog,
  Tag,
  LogOut,
  Dumbbell,
  Fingerprint,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { temPermissao } from '../lib/permissoes';

const itensNav = [
  { to: '/', label: 'Dashboard', icone: LayoutDashboard, fim: true }, // sempre visível
  { to: '/alunos', label: 'Alunos', icone: Users, modulo: 'alunos' },
  { to: '/matriculas', label: 'Matrículas', icone: ClipboardCheck, modulo: 'matriculas' },
  { to: '/mensalidades', label: 'Mensalidades', icone: Receipt, modulo: 'mensalidades' },
  { to: '/caixa', label: 'Caixa', icone: Wallet, modulo: 'caixa' },
  { to: '/acesso', label: 'Controle de Acesso', icone: Fingerprint, modulo: 'acesso' },
  { to: '/relatorios', label: 'Relatórios', icone: BarChart3, modulo: 'relatorios' },
  { to: '/agendamentos', label: 'Agendamentos', icone: CalendarClock, modulo: 'agendamentos' },
];

export default function Layout({ children }) {
  const { funcionario, academia, sair } = useAuth();
  const navigate = useNavigate();

  async function handleSair() {
    sair();
    navigate('/login');
  }

  const itensVisiveis = itensNav.filter((item) => !item.modulo || temPermissao(funcionario, item.modulo));

  return (
    <div className="flex h-screen bg-graphite-950 text-white">
      <aside className="w-64 shrink-0 bg-graphite-900 border-r border-graphite-800 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-graphite-800">
          <div className="h-8 w-8 rounded-lg bg-ember-500 flex items-center justify-center shrink-0">
            <Dumbbell className="text-white" size={18} />
          </div>
          <span className="font-display font-semibold text-lg tracking-tight truncate">{academia?.nome}</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {itensVisiveis.map(({ to, label, icone: Icone, fim }) => (
            <NavLink
              key={to}
              to={to}
              end={fim}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-ember-500/15 text-ember-400'
                    : 'text-steel-400 hover:text-white hover:bg-graphite-800'
                }`
              }
            >
              <Icone size={18} strokeWidth={2} />
              {label}
            </NavLink>
          ))}

          {funcionario?.tipo === 'admin' && (
            <>
              <div className="h-px bg-graphite-800 my-3 mx-1" />
              <NavLink
                to="/planos"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-ember-500/15 text-ember-400'
                      : 'text-steel-400 hover:text-white hover:bg-graphite-800'
                  }`
                }
              >
                <Tag size={18} strokeWidth={2} />
                Planos
              </NavLink>
              <NavLink
                to="/funcionarios"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-ember-500/15 text-ember-400'
                      : 'text-steel-400 hover:text-white hover:bg-graphite-800'
                  }`
                }
              >
                <UserCog size={18} strokeWidth={2} />
                Funcionários
              </NavLink>
              <NavLink
                to="/configuracao-pagamento"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-ember-500/15 text-ember-400'
                      : 'text-steel-400 hover:text-white hover:bg-graphite-800'
                  }`
                }
              >
                <CreditCard size={18} strokeWidth={2} />
                Gateway de Pagamento
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-graphite-800">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-graphite-700 flex items-center justify-center text-xs font-semibold shrink-0">
              {(funcionario?.nome || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{funcionario?.nome}</p>
              <p className="text-xs text-steel-500 capitalize">{funcionario?.tipo}</p>
            </div>
            <button
              onClick={handleSair}
              title="Sair"
              className="p-1.5 rounded-md text-steel-400 hover:text-rose-400 hover:bg-graphite-800 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
