import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, TrendingDown, TrendingUp, Wallet, ArrowRight } from 'lucide-react';
import api from '../lib/api';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function AnelAdimplencia({ percentual }) {
  const raio = 54;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia - (percentual / 100) * circunferencia;
  const cor = percentual >= 80 ? '#2DD4A7' : percentual >= 50 ? '#FFB238' : '#FB4D5C';

  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={raio} fill="none" stroke="#22252D" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={raio}
          fill="none"
          stroke={cor}
          strokeWidth="10"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-semibold text-white">{percentual}%</span>
        <span className="text-xs text-steel-400 mt-0.5">em dia</span>
      </div>
    </div>
  );
}

function CardEstatistica({ titulo, valor, subtitulo, icone: Icone, tom }) {
  const tons = {
    ember: 'bg-ember-500/15 text-ember-400',
    mint: 'bg-mint-500/15 text-mint-400',
    amber: 'bg-amber-500/15 text-amber-400',
    rose: 'bg-rose-500/15 text-rose-400',
  };
  return (
    <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-steel-400 text-sm font-medium">{titulo}</span>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tons[tom]}`}>
          <Icone size={16} />
        </div>
      </div>
      <p className="font-display text-2xl font-semibold text-white tabular">{valor}</p>
      {subtitulo && <p className="text-steel-500 text-xs mt-1">{subtitulo}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [resumo, setResumo] = useState(null);
  const [inadimplentes, setInadimplentes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const [resResumo, resInadim] = await Promise.all([
          api.get('/dashboard/resumo'),
          api.get('/dashboard/inadimplencia'),
        ]);
        setResumo(resResumo.data);
        setInadimplentes(resInadim.data.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-steel-400 text-sm mt-1">Visão geral da academia hoje</p>
      </div>

      {carregando ? (
        <div className="text-steel-400 text-sm">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <CardEstatistica
              titulo="Alunos ativos"
              valor={resumo?.alunos_ativos ?? 0}
              icone={Users}
              tom="ember"
            />
            <CardEstatistica
              titulo="Recebido no mês"
              valor={formatarMoeda(resumo?.valor_recebido_mes)}
              subtitulo={`${resumo?.qtd_pagas_mes ?? 0} mensalidades pagas`}
              icone={TrendingUp}
              tom="mint"
            />
            <CardEstatistica
              titulo="Em atraso"
              valor={formatarMoeda(resumo?.valor_atrasado)}
              subtitulo={`${resumo?.qtd_atrasadas ?? 0} mensalidades`}
              icone={TrendingDown}
              tom="rose"
            />
            <CardEstatistica
              titulo="Caixa hoje"
              valor={resumo?.caixa_aberto ? formatarMoeda(resumo?.total_caixa_hoje) : 'Fechado'}
              subtitulo={resumo?.caixa_aberto ? 'Sessão aberta' : 'Nenhuma sessão aberta'}
              icone={Wallet}
              tom="amber"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-6 flex items-center gap-6">
              <AnelAdimplencia percentual={resumo?.taxa_adimplencia ?? 100} />
              <div>
                <h3 className="font-display font-semibold text-white mb-1">Taxa de adimplência</h3>
                <p className="text-steel-400 text-sm">
                  Percentual de mensalidades do mês pagas em dia, considerando pagas, em aberto e atrasadas.
                </p>
              </div>
            </div>

            <div className="lg:col-span-2 bg-graphite-900 border border-graphite-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-white">Alunos em atraso</h3>
                <Link
                  to="/relatorios"
                  className="text-ember-400 text-sm font-medium flex items-center gap-1 hover:text-ember-300"
                >
                  Ver relatório completo <ArrowRight size={14} />
                </Link>
              </div>

              {inadimplentes.length === 0 ? (
                <p className="text-steel-500 text-sm py-6 text-center">
                  Nenhum aluno em atraso no momento. 🎉
                </p>
              ) : (
                <div className="space-y-3">
                  {inadimplentes.map((m) => (
                    <Link
                      to={`/alunos/${m.alunos?.id}`}
                      key={m.id}
                      className="flex items-center justify-between py-2 border-b border-graphite-800 last:border-0 hover:bg-graphite-800/50 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{m.alunos?.nome}</p>
                        <p className="text-xs text-steel-500">{m.dias_atraso} dias em atraso</p>
                      </div>
                      <span className="text-sm font-semibold text-rose-400 tabular">
                        {formatarMoeda(m.valor)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
