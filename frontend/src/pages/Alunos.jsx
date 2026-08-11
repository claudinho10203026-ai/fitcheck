import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, X, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { temPermissao } from '../lib/permissoes';

const ALUNO_VAZIO = {
  nome: '',
  cpf: '',
  email: '',
  telefone: '',
  data_nascimento: '',
  sexo: '',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  peso_kg: '',
  altura_cm: '',
  objetivo: '',
  observacoes_medicas: '',
  contato_emergencia_nome: '',
  contato_emergencia_telefone: '',
};

function Campo({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-steel-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputClasse =
  'w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm placeholder-steel-500 focus:outline-none focus:ring-2 focus:ring-ember-500 focus:border-transparent';

function ModalNovoAluno({ aberto, aoFechar, aoSalvar }) {
  const [form, setForm] = useState(ALUNO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setForm(ALUNO_VAZIO);
      setErro('');
    }
  }, [aberto]);

  if (!aberto) return null;

  function atualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      const payload = { ...form };
      // remove campos numéricos vazios para não quebrar o insert
      ['peso_kg', 'altura_cm'].forEach((c) => {
        if (payload[c] === '') delete payload[c];
      });
      const { data } = await api.post('/alunos', payload);
      aoSalvar(data);
      aoFechar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao cadastrar aluno.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl w-full max-w-2xl mt-8 mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800">
          <h2 className="font-display font-semibold text-lg text-white">Cadastro de aluno</h2>
          <button onClick={aoFechar} className="text-steel-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="p-6 space-y-6">
          <section>
            <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-3">
              Dados pessoais
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Campo label="Nome completo *">
                  <input
                    required
                    className={inputClasse}
                    value={form.nome}
                    onChange={(e) => atualizarCampo('nome', e.target.value)}
                  />
                </Campo>
              </div>
              <Campo label="CPF *">
                <input
                  required
                  className={inputClasse}
                  value={form.cpf}
                  onChange={(e) => atualizarCampo('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                />
              </Campo>
              <Campo label="Data de nascimento">
                <input
                  type="date"
                  className={inputClasse}
                  value={form.data_nascimento}
                  onChange={(e) => atualizarCampo('data_nascimento', e.target.value)}
                />
              </Campo>
              <Campo label="E-mail">
                <input
                  type="email"
                  className={inputClasse}
                  value={form.email}
                  onChange={(e) => atualizarCampo('email', e.target.value)}
                />
              </Campo>
              <Campo label="Telefone">
                <input
                  className={inputClasse}
                  value={form.telefone}
                  onChange={(e) => atualizarCampo('telefone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </Campo>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-3">Endereço</h3>
            <div className="grid grid-cols-3 gap-4">
              <Campo label="CEP">
                <input className={inputClasse} value={form.cep} onChange={(e) => atualizarCampo('cep', e.target.value)} />
              </Campo>
              <div className="col-span-2">
                <Campo label="Endereço">
                  <input
                    className={inputClasse}
                    value={form.endereco}
                    onChange={(e) => atualizarCampo('endereco', e.target.value)}
                  />
                </Campo>
              </div>
              <Campo label="Número">
                <input
                  className={inputClasse}
                  value={form.numero}
                  onChange={(e) => atualizarCampo('numero', e.target.value)}
                />
              </Campo>
              <Campo label="Bairro">
                <input
                  className={inputClasse}
                  value={form.bairro}
                  onChange={(e) => atualizarCampo('bairro', e.target.value)}
                />
              </Campo>
              <Campo label="Cidade">
                <input
                  className={inputClasse}
                  value={form.cidade}
                  onChange={(e) => atualizarCampo('cidade', e.target.value)}
                />
              </Campo>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-3">
              Ficha física e saúde
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <Campo label="Peso (kg)">
                <input
                  type="number"
                  step="0.1"
                  className={inputClasse}
                  value={form.peso_kg}
                  onChange={(e) => atualizarCampo('peso_kg', e.target.value)}
                />
              </Campo>
              <Campo label="Altura (cm)">
                <input
                  type="number"
                  step="0.1"
                  className={inputClasse}
                  value={form.altura_cm}
                  onChange={(e) => atualizarCampo('altura_cm', e.target.value)}
                />
              </Campo>
              <Campo label="Objetivo">
                <input
                  className={inputClasse}
                  placeholder="Hipertrofia, emagrecimento..."
                  value={form.objetivo}
                  onChange={(e) => atualizarCampo('objetivo', e.target.value)}
                />
              </Campo>
              <div className="col-span-3">
                <Campo label="Observações médicas">
                  <textarea
                    className={inputClasse}
                    rows={2}
                    value={form.observacoes_medicas}
                    onChange={(e) => atualizarCampo('observacoes_medicas', e.target.value)}
                  />
                </Campo>
              </div>
              <Campo label="Contato de emergência">
                <input
                  className={inputClasse}
                  value={form.contato_emergencia_nome}
                  onChange={(e) => atualizarCampo('contato_emergencia_nome', e.target.value)}
                />
              </Campo>
              <Campo label="Telefone de emergência">
                <input
                  className={inputClasse}
                  value={form.contato_emergencia_telefone}
                  onChange={(e) => atualizarCampo('contato_emergencia_telefone', e.target.value)}
                />
              </Campo>
            </div>
          </section>

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
              {salvando ? 'Salvando...' : 'Cadastrar aluno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BadgeStatus({ status }) {
  const estilos = {
    ativo: 'bg-mint-500/15 text-mint-400',
    inativo: 'bg-steel-500/15 text-steel-400',
    suspenso: 'bg-rose-500/15 text-rose-400',
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${estilos[status] || estilos.inativo}`}>
      {status}
    </span>
  );
}

export default function Alunos() {
  const { funcionario } = useAuth();
  const podeGerenciar = temPermissao(funcionario, 'alunos', 'gerenciar');
  const [alunos, setAlunos] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  async function carregarAlunos(termo = '') {
    setCarregando(true);
    try {
      const { data } = await api.get('/alunos', { params: termo ? { busca: termo } : {} });
      setAlunos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarAlunos();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => carregarAlunos(busca), 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Alunos</h1>
          <p className="text-steel-400 text-sm mt-1">Cadastro e gestão de alunos da academia</p>
        </div>
        {podeGerenciar && (
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-2 bg-ember-500 hover:bg-ember-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} /> Novo aluno
          </button>
        )}
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" size={16} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou e-mail..."
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-graphite-900 border border-graphite-800 text-white text-sm placeholder-steel-500 focus:outline-none focus:ring-2 focus:ring-ember-500"
        />
      </div>

      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl overflow-hidden">
        {carregando ? (
          <p className="text-steel-400 text-sm p-6">Carregando...</p>
        ) : alunos.length === 0 ? (
          <p className="text-steel-500 text-sm p-6 text-center">Nenhum aluno encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-800 text-left text-steel-400">
                <th className="font-medium px-5 py-3">Nome</th>
                <th className="font-medium px-5 py-3">CPF</th>
                <th className="font-medium px-5 py-3">Telefone</th>
                <th className="font-medium px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {alunos.map((aluno) => (
                <tr key={aluno.id} className="border-b border-graphite-800 last:border-0">
                  <td className="px-5 py-3">
                    <Link to={`/alunos/${aluno.id}`} className="flex items-center gap-2.5 font-medium text-white hover:text-ember-400">
                      {aluno.foto_url ? (
                        <img src={aluno.foto_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="h-7 w-7 rounded-full bg-graphite-800 text-ember-400 text-xs font-semibold flex items-center justify-center shrink-0">
                          {aluno.nome?.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      {aluno.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-steel-400">{aluno.cpf}</td>
                  <td className="px-5 py-3 text-steel-400">{aluno.telefone || '-'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <BadgeStatus status={aluno.status} />
                      {aluno.bloqueado && (
                        <span
                          title="Bloqueado na catraca"
                          className="text-xs font-medium px-2 py-1 rounded-full bg-rose-500/15 text-rose-400"
                        >
                          Bloqueado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/alunos/${aluno.id}`} className="text-steel-500 hover:text-white inline-flex">
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ModalNovoAluno
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoSalvar={() => carregarAlunos(busca)}
      />
    </div>
  );
}
