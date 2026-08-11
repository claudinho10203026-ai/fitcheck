import { useEffect, useState } from 'react';
import { Plus, X, CheckCircle2, Search } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { temPermissao } from '../lib/permissoes';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(data) {
  if (!data) return '-';
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

const BADGES = {
  ativa: 'bg-mint-500/15 text-mint-400',
  pendente: 'bg-amber-500/15 text-amber-400',
  suspensa: 'bg-rose-500/15 text-rose-400',
  cancelada: 'bg-steel-500/15 text-steel-400',
};

function ModalNovaMatricula({ aberto, aoFechar, aoSalvar }) {
  const [busca, setBusca] = useState('');
  const [opcoesAluno, setOpcoesAluno] = useState([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [planoId, setPlanoId] = useState('');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      api.get('/planos').then((res) => setPlanos(res.data));
      setBusca('');
      setAlunoSelecionado(null);
      setPlanoId('');
      setErro('');
    }
  }, [aberto]);

  useEffect(() => {
    if (!busca || alunoSelecionado) return setOpcoesAluno([]);
    const timeout = setTimeout(() => {
      api.get('/alunos', { params: { busca } }).then((res) => setOpcoesAluno(res.data));
    }, 300);
    return () => clearTimeout(timeout);
  }, [busca, alunoSelecionado]);

  if (!aberto) return null;

  async function handleSalvar(e) {
    e.preventDefault();
    if (!alunoSelecionado || !planoId) {
      setErro('Selecione o aluno e o plano.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const { data } = await api.post('/matriculas', {
        aluno_id: alunoSelecionado.id,
        plano_id: planoId,
        data_inicio: dataInicio,
      });
      aoSalvar(data);
      aoFechar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao criar matrícula.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800">
          <h2 className="font-display font-semibold text-lg text-white">Nova matrícula</h2>
          <button onClick={aoFechar} className="text-steel-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Aluno *</label>
            {alunoSelecionado ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-sm">
                <span className="text-white">{alunoSelecionado.nome}</span>
                <button
                  type="button"
                  onClick={() => setAlunoSelecionado(null)}
                  className="text-steel-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" size={14} />
                <input
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
                  placeholder="Buscar aluno por nome ou CPF..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                {opcoesAluno.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-graphite-800 border border-graphite-700 rounded-lg max-h-40 overflow-y-auto">
                    {opcoesAluno.map((a) => (
                      <button
                        type="button"
                        key={a.id}
                        onClick={() => {
                          setAlunoSelecionado(a);
                          setOpcoesAluno([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-graphite-700"
                      >
                        {a.nome} <span className="text-steel-500">· {a.cpf}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Plano *</label>
            <select
              required
              value={planoId}
              onChange={(e) => setPlanoId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
            >
              <option value="">Selecione um plano</option>
              {planos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} - {formatarMoeda(p.valor)} ({p.duracao_meses}m)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Data de início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
            />
          </div>

          {erro && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {erro}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={aoFechar}
              className="px-4 py-2 rounded-lg text-sm font-medium text-steel-300 hover:bg-graphite-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-ember-500 hover:bg-ember-600 disabled:opacity-60 text-white"
            >
              {salvando ? 'Criando...' : 'Criar matrícula'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Matriculas() {
  const { funcionario } = useAuth();
  const podeGerenciar = temPermissao(funcionario, 'matriculas', 'gerenciar');
  const [matriculas, setMatriculas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [liberando, setLiberando] = useState(null);

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get('/matriculas', { params: filtro ? { status: filtro } : {} });
      setMatriculas(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function handleLiberar(id) {
    setLiberando(id);
    try {
      await api.put(`/matriculas/${id}/liberar`);
      carregar();
    } catch (err) {
      console.error(err);
    } finally {
      setLiberando(null);
    }
  }

  const abas = [
    { valor: '', label: 'Todas' },
    { valor: 'pendente', label: 'Pendentes' },
    { valor: 'ativa', label: 'Ativas' },
    { valor: 'suspensa', label: 'Suspensas' },
    { valor: 'cancelada', label: 'Canceladas' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Liberação de matrícula</h1>
          <p className="text-steel-400 text-sm mt-1">Crie e ative matrículas de alunos nos planos da academia</p>
        </div>
        {podeGerenciar && (
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-2 bg-ember-500 hover:bg-ember-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} /> Nova matrícula
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        {abas.map((aba) => (
          <button
            key={aba.valor}
            onClick={() => setFiltro(aba.valor)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtro === aba.valor
                ? 'bg-ember-500/15 text-ember-400'
                : 'text-steel-400 hover:text-white hover:bg-graphite-800'
            }`}
          >
            {aba.label}
          </button>
        ))}
      </div>

      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl overflow-hidden">
        {carregando ? (
          <p className="text-steel-400 text-sm p-6">Carregando...</p>
        ) : matriculas.length === 0 ? (
          <p className="text-steel-500 text-sm p-6 text-center">Nenhuma matrícula encontrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-800 text-left text-steel-400">
                <th className="font-medium px-5 py-3">Aluno</th>
                <th className="font-medium px-5 py-3">Plano</th>
                <th className="font-medium px-5 py-3">Início</th>
                <th className="font-medium px-5 py-3">Fim</th>
                <th className="font-medium px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {matriculas.map((m) => (
                <tr key={m.id} className="border-b border-graphite-800 last:border-0">
                  <td className="px-5 py-3 text-white font-medium">{m.alunos?.nome}</td>
                  <td className="px-5 py-3 text-steel-400">{m.planos?.nome}</td>
                  <td className="px-5 py-3 text-steel-400">{formatarData(m.data_inicio)}</td>
                  <td className="px-5 py-3 text-steel-400">{formatarData(m.data_fim)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${BADGES[m.status]}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {m.status === 'pendente' && podeGerenciar && (
                      <button
                        onClick={() => handleLiberar(m.id)}
                        disabled={liberando === m.id}
                        className="flex items-center gap-1.5 ml-auto text-mint-400 hover:text-mint-300 text-sm font-medium disabled:opacity-60"
                      >
                        <CheckCircle2 size={14} /> {liberando === m.id ? 'Liberando...' : 'Liberar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ModalNovaMatricula aberto={modalAberto} aoFechar={() => setModalAberto(false)} aoSalvar={() => carregar()} />
    </div>
  );
}
