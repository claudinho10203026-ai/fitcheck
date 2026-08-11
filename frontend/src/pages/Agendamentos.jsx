import { useEffect, useState } from 'react';
import {
  Plus, X, Search, Calendar, Clock, CheckCircle2, XCircle, UserX, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { temPermissao } from '../lib/permissoes';

function formatarDataExtenso(data) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });
}
function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function somarDias(data, dias) {
  const d = new Date(`${data}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const BADGES_STATUS = {
  confirmado: 'bg-amber-500/15 text-amber-400',
  realizado: 'bg-mint-500/15 text-mint-400',
  cancelado: 'bg-steel-500/15 text-steel-400',
  falta: 'bg-rose-500/15 text-rose-400',
};

const inputClasse =
  'w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm placeholder-steel-500 focus:outline-none focus:ring-2 focus:ring-ember-500';

function ModalNovoAgendamento({ aberto, data, aoFechar, aoSalvar }) {
  const [busca, setBusca] = useState('');
  const [opcoesAluno, setOpcoesAluno] = useState([]);
  const [aluno, setAluno] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [funcionarioId, setFuncionarioId] = useState('');
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFim, setHoraFim] = useState('09:00');
  const [servico, setServico] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      api.get('/agendamentos/profissionais').then((res) => setProfissionais(res.data));
      setBusca('');
      setAluno(null);
      setFuncionarioId('');
      setHoraInicio('08:00');
      setHoraFim('09:00');
      setServico('');
      setObservacoes('');
      setErro('');
    }
  }, [aberto]);

  useEffect(() => {
    if (!busca || aluno) return setOpcoesAluno([]);
    const t = setTimeout(() => {
      api.get('/alunos', { params: { busca } }).then((res) => setOpcoesAluno(res.data));
    }, 300);
    return () => clearTimeout(t);
  }, [busca, aluno]);

  if (!aberto) return null;

  async function handleSalvar(e) {
    e.preventDefault();
    if (!aluno || !funcionarioId) {
      setErro('Selecione o aluno e o profissional.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await api.post('/agendamentos', {
        aluno_id: aluno.id,
        funcionario_id: funcionarioId,
        data,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        servico,
        observacoes,
      });
      aoSalvar();
      aoFechar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao criar agendamento.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl w-full max-w-md mt-8 mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800">
          <h2 className="font-display font-semibold text-lg text-white">Novo agendamento</h2>
          <button onClick={aoFechar} className="text-steel-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="p-6 space-y-4">
          <p className="text-xs text-steel-500 -mt-2">{formatarDataExtenso(data)}</p>

          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Aluno *</label>
            {aluno ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-sm">
                <span className="text-white">{aluno.nome}</span>
                <button type="button" onClick={() => setAluno(null)} className="text-steel-500 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" size={14} />
                <input
                  autoFocus
                  className={`${inputClasse} pl-9`}
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
                          setAluno(a);
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
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Profissional *</label>
            {profissionais.length === 0 ? (
              <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                Nenhum funcionário está marcado como "agendável" ainda. Ajuste isso em Funcionários.
              </p>
            ) : (
              <select required value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)} className={inputClasse}>
                <option value="">Selecione o profissional</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} {p.especialidade && `· ${p.especialidade}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-steel-400 mb-1.5">Início *</label>
              <input type="time" required value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={inputClasse} />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-400 mb-1.5">Fim *</label>
              <input type="time" required value={horaFim} onChange={(e) => setHoraFim(e.target.value)} className={inputClasse} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Serviço</label>
            <input className={inputClasse} placeholder="ex: Personal Training, Avaliação física" value={servico} onChange={(e) => setServico(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Observações</label>
            <textarea rows={2} className={inputClasse} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

          {erro && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{erro}</div>
          )}

          <button
            type="submit"
            disabled={salvando || profissionais.length === 0}
            className="w-full bg-ember-500 hover:bg-ember-600 disabled:opacity-60 text-white font-medium text-sm py-2.5 rounded-lg"
          >
            {salvando ? 'Agendando...' : 'Confirmar agendamento'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Agendamentos() {
  const { funcionario } = useAuth();
  const podeGerenciar = temPermissao(funcionario, 'agendamentos', 'gerenciar');

  const [data, setData] = useState(hoje());
  const [agendamentos, setAgendamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const { data: lista } = await api.get('/agendamentos', { params: { data } });
      setAgendamentos(lista);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function atualizarStatus(id, status) {
    try {
      await api.put(`/agendamentos/${id}/status`, { status });
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao atualizar agendamento.');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Agendamentos</h1>
          <p className="text-steel-400 text-sm mt-1">Horários com profissional escolhido pelo aluno</p>
        </div>
        {podeGerenciar && (
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-2 bg-ember-500 hover:bg-ember-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} /> Novo agendamento
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => setData(somarDias(data, -1))} className="p-2 rounded-lg border border-graphite-800 text-steel-400 hover:text-white hover:bg-graphite-800">
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-graphite-900 border border-graphite-800">
          <Calendar size={15} className="text-steel-500" />
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="bg-transparent text-white text-sm focus:outline-none" />
        </div>
        <button onClick={() => setData(somarDias(data, 1))} className="p-2 rounded-lg border border-graphite-800 text-steel-400 hover:text-white hover:bg-graphite-800">
          <ChevronRight size={16} />
        </button>
        <button onClick={() => setData(hoje())} className="text-ember-400 text-sm font-medium hover:text-ember-300">
          Hoje
        </button>
        <span className="text-steel-500 text-sm capitalize">{formatarDataExtenso(data)}</span>
      </div>

      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl overflow-hidden">
        {carregando ? (
          <p className="text-steel-400 text-sm p-6">Carregando...</p>
        ) : agendamentos.length === 0 ? (
          <div className="p-10 text-center">
            <Clock className="mx-auto text-steel-600 mb-3" size={32} />
            <p className="text-steel-400 text-sm">Nenhum agendamento para esse dia.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-800 text-left text-steel-400">
                <th className="font-medium px-5 py-3">Horário</th>
                <th className="font-medium px-5 py-3">Aluno</th>
                <th className="font-medium px-5 py-3">Profissional</th>
                <th className="font-medium px-5 py-3">Serviço</th>
                <th className="font-medium px-5 py-3">Status</th>
                {podeGerenciar && <th className="px-5 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {agendamentos.map((a) => (
                <tr key={a.id} className="border-b border-graphite-800 last:border-0">
                  <td className="px-5 py-3 text-white font-medium tabular">
                    {a.hora_inicio?.slice(0, 5)}–{a.hora_fim?.slice(0, 5)}
                  </td>
                  <td className="px-5 py-3 text-steel-300">{a.alunos?.nome}</td>
                  <td className="px-5 py-3 text-steel-300">{a.funcionarios?.nome}</td>
                  <td className="px-5 py-3 text-steel-400">{a.servico || '-'}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${BADGES_STATUS[a.status]}`}>
                      {a.status}
                    </span>
                  </td>
                  {podeGerenciar && (
                    <td className="px-5 py-3">
                      {a.status === 'confirmado' && (
                        <div className="flex items-center gap-3 justify-end">
                          <button onClick={() => atualizarStatus(a.id, 'realizado')} title="Marcar realizado" className="text-mint-400 hover:text-mint-300">
                            <CheckCircle2 size={16} />
                          </button>
                          <button onClick={() => atualizarStatus(a.id, 'falta')} title="Marcar falta" className="text-amber-400 hover:text-amber-300">
                            <UserX size={16} />
                          </button>
                          <button onClick={() => atualizarStatus(a.id, 'cancelado')} title="Cancelar" className="text-rose-400 hover:text-rose-300">
                            <XCircle size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ModalNovoAgendamento aberto={modalAberto} data={data} aoFechar={() => setModalAberto(false)} aoSalvar={carregar} />
    </div>
  );
}
