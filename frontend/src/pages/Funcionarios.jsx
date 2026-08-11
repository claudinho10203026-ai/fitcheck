import { useEffect, useState } from 'react';
import { Plus, X, UserCog, Power } from 'lucide-react';
import api from '../lib/api';
import { MODULOS } from '../lib/permissoes';

const NOMES_MODULO = {
  alunos: 'Alunos',
  matriculas: 'Matrículas',
  mensalidades: 'Mensalidades',
  caixa: 'Caixa',
  relatorios: 'Relatórios',
  agendamentos: 'Agendamentos',
  acesso: 'Controle de Acesso',
};

const PERMISSOES_VAZIAS = Object.fromEntries(MODULOS.map((m) => [m, 'nenhum']));

function ModalFuncionario({ funcionario, aberto, aoFechar, aoSalvar }) {
  const editando = Boolean(funcionario);
  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState('membro');
  const [permissoes, setPermissoes] = useState(PERMISSOES_VAZIAS);
  const [agendavel, setAgendavel] = useState(false);
  const [especialidade, setEspecialidade] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setNome(funcionario?.nome || '');
      setUsuario(funcionario?.usuario || '');
      setSenha('');
      setTipo(funcionario?.tipo || 'membro');
      setPermissoes({ ...PERMISSOES_VAZIAS, ...(funcionario?.permissoes || {}) });
      setAgendavel(Boolean(funcionario?.agendavel));
      setEspecialidade(funcionario?.especialidade || '');
      setErro('');
    }
  }, [aberto, funcionario]);

  if (!aberto) return null;

  async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      const payload = { nome, tipo, permissoes, agendavel, especialidade };
      if (!editando) {
        payload.usuario = usuario;
        payload.senha = senha;
      } else if (senha) {
        payload.senha = senha;
      }

      if (editando) {
        await api.put(`/funcionarios/${funcionario.id}`, payload);
      } else {
        await api.post('/funcionarios', payload);
      }
      aoSalvar();
      aoFechar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar funcionário.');
    } finally {
      setSalvando(false);
    }
  }

  const inputClasse =
    'w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm placeholder-steel-500 focus:outline-none focus:ring-2 focus:ring-ember-500';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl w-full max-w-lg mt-8 mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800">
          <h2 className="font-display font-semibold text-lg text-white">
            {editando ? 'Editar funcionário' : 'Novo funcionário'}
          </h2>
          <button onClick={aoFechar} className="text-steel-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-steel-400 mb-1.5">Nome *</label>
              <input required className={inputClasse} value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-400 mb-1.5">
                Usuário (login) {editando && <span className="text-steel-600">- fixo</span>}
              </label>
              <input
                required
                disabled={editando}
                className={`${inputClasse} disabled:opacity-50`}
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="ex: joao.silva"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-steel-400 mb-1.5">
                Senha {editando ? '(deixe em branco para manter)' : '*'}
              </label>
              <input
                type="password"
                required={!editando}
                className={inputClasse}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-400 mb-1.5">Tipo de conta</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClasse}>
                <option value="membro">Membro (permissões abaixo)</option>
                <option value="admin">Admin (acesso total)</option>
              </select>
            </div>
          </div>

          <div className="bg-graphite-800/60 border border-graphite-700 rounded-lg px-3 py-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-steel-200">
              <input
                type="checkbox"
                checked={agendavel}
                onChange={(e) => setAgendavel(e.target.checked)}
                className="rounded border-graphite-700 bg-graphite-800 text-ember-500 focus:ring-ember-500"
              />
              Aparece como profissional na tela de Agendamentos
            </label>
            {agendavel && (
              <input
                className={inputClasse}
                placeholder="Especialidade (ex: Musculação, Pilates, Funcional)"
                value={especialidade}
                onChange={(e) => setEspecialidade(e.target.value)}
              />
            )}
          </div>

          {tipo === 'membro' && (
            <div>
              <label className="block text-xs font-medium text-steel-400 mb-2">Permissões por tela</label>
              <div className="space-y-2">
                {MODULOS.map((modulo) => (
                  <div
                    key={modulo}
                    className="flex items-center justify-between bg-graphite-800/60 border border-graphite-700 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-steel-200">{NOMES_MODULO[modulo]}</span>
                    <select
                      value={permissoes[modulo]}
                      onChange={(e) => setPermissoes({ ...permissoes, [modulo]: e.target.value })}
                      className="px-2 py-1 rounded-md bg-graphite-800 border border-graphite-700 text-white text-xs"
                    >
                      <option value="nenhum">Sem acesso</option>
                      <option value="visualizar">Visualizar</option>
                      <option value="gerenciar">Gerenciar</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar funcionário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Funcionarios() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoFuncionario, setEditandoFuncionario] = useState(null);

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get('/funcionarios');
      setLista(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirNovo() {
    setEditandoFuncionario(null);
    setModalAberto(true);
  }

  function abrirEdicao(f) {
    setEditandoFuncionario(f);
    setModalAberto(true);
  }

  async function alternarAtivo(f) {
    try {
      await api.put(`/funcionarios/${f.id}`, { ativo: !f.ativo });
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao atualizar funcionário.');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Funcionários</h1>
          <p className="text-steel-400 text-sm mt-1">Contas de acesso e permissões por tela</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 bg-ember-500 hover:bg-ember-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} /> Novo funcionário
        </button>
      </div>

      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl overflow-hidden">
        {carregando ? (
          <p className="text-steel-400 text-sm p-6">Carregando...</p>
        ) : lista.length === 0 ? (
          <p className="text-steel-500 text-sm p-6 text-center">Nenhum funcionário cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-800 text-left text-steel-400">
                <th className="font-medium px-5 py-3">Nome</th>
                <th className="font-medium px-5 py-3">Usuário</th>
                <th className="font-medium px-5 py-3">Tipo</th>
                <th className="font-medium px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id} className="border-b border-graphite-800 last:border-0">
                  <td className="px-5 py-3">
                    <button
                      onClick={() => abrirEdicao(f)}
                      className="font-medium text-white hover:text-ember-400 flex items-center gap-1.5"
                    >
                      <UserCog size={14} className="text-steel-500" /> {f.nome}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-steel-400">{f.usuario}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${
                        f.tipo === 'admin' ? 'bg-ember-500/15 text-ember-400' : 'bg-steel-500/15 text-steel-300'
                      }`}
                    >
                      {f.tipo}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        f.ativo ? 'bg-mint-500/15 text-mint-400' : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => alternarAtivo(f)}
                      title={f.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                      className="text-steel-500 hover:text-white inline-flex items-center gap-1 text-xs"
                    >
                      <Power size={13} /> {f.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ModalFuncionario
        funcionario={editandoFuncionario}
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoSalvar={carregar}
      />
    </div>
  );
}
