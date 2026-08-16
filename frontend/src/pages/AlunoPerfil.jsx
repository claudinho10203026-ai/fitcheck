import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Save, X, Phone, Mail, MapPin, HeartPulse, Receipt,
  Camera, Loader2, AlertTriangle, Wallet, TrendingUp, TrendingDown, Percent, Fingerprint,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { temPermissao } from '../lib/permissoes';
import { redimensionarImagem } from '../lib/imagem';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(data) {
  if (!data) return '-';
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

const BADGES_MENSALIDADE = {
  pago: 'bg-mint-500/15 text-mint-400',
  em_aberto: 'bg-amber-500/15 text-amber-400',
  atrasado: 'bg-rose-500/15 text-rose-400',
  cancelado: 'bg-steel-500/15 text-steel-400',
};
const BADGES_MATRICULA = {
  ativa: 'bg-mint-500/15 text-mint-400',
  pendente: 'bg-amber-500/15 text-amber-400',
  suspensa: 'bg-rose-500/15 text-rose-400',
  cancelada: 'bg-steel-500/15 text-steel-400',
};

const PERGUNTAS_PARQ = [
  { id: 'q1', texto: 'Algum médico já disse que você tem um problema cardíaco e recomendou atividade física só sob supervisão?' },
  { id: 'q2', texto: 'Você sente dor no peito ao praticar atividade física?' },
  { id: 'q3', texto: 'No último mês, sentiu dor no peito mesmo sem praticar atividade física?' },
  { id: 'q4', texto: 'Você perde o equilíbrio por tontura ou já perdeu a consciência?' },
  { id: 'q5', texto: 'Tem algum problema ósseo ou articular que pode piorar com a atividade física?' },
  { id: 'q6', texto: 'Está em tratamento médico contínuo para pressão arterial ou problema cardíaco?' },
  { id: 'q7', texto: 'Existe algum outro motivo para não praticar atividade física sem avaliação médica prévia?' },
];

const CONDICOES_PREEXISTENTES = [
  { id: 'hipertensao', label: 'Hipertensão' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'cardiopatia', label: 'Problema cardíaco' },
  { id: 'problema_articular', label: 'Problema articular/ósseo' },
  { id: 'problema_respiratorio', label: 'Problema respiratório (ex: asma)' },
];

const FICHA_MEDICA_VAZIA = {
  tipo_sanguineo: '',
  par_q: {},
  condicoes: {},
  condicao_outra: '',
  medicamentos_uso_continuo: '',
  alergias: '',
  cirurgias_recentes: '',
  atestado: { status: '', data_emissao: '', validade: '', medico_nome: '', medico_crm: '' },
};

const ABAS = [
  { id: 'geral', label: 'Geral' },
  { id: 'medica', label: 'Ficha Médica' },
  { id: 'financeiro', label: 'Financeiro' },
];

const inputClasse =
  'w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm placeholder-steel-500 focus:outline-none focus:ring-2 focus:ring-ember-500';

function Campo({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-steel-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function AlunoPerfil() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { funcionario } = useAuth();
  const podeGerenciar = temPermissao(funcionario, 'alunos', 'gerenciar');

  const [aluno, setAluno] = useState(null);
  const [matriculas, setMatriculas] = useState([]);
  const [mensalidades, setMensalidades] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('geral');

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get(`/alunos/${id}`);
      setAluno(data.aluno);
      setForm({ ...data.aluno, ficha_medica: { ...FICHA_MEDICA_VAZIA, ...(data.aluno.ficha_medica || {}) } });
      setMatriculas(data.matriculas);
      setMensalidades(data.mensalidades);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSalvar() {
    setSalvando(true);
    try {
      const { data } = await api.put(`/alunos/${id}`, form);
      setAluno(data);
      setForm({ ...data, ficha_medica: { ...FICHA_MEDICA_VAZIA, ...(data.ficha_medica || {}) } });
      setEditando(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  }

  async function handleUploadFoto(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviandoFoto(true);
    try {
      const base64 = await redimensionarImagem(arquivo);
      const { data } = await api.post(`/alunos/${id}/foto`, { foto_base64: base64 });
      setAluno(data);
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar a foto. Tente uma imagem menor ou outro formato.');
    } finally {
      setEnviandoFoto(false);
      e.target.value = '';
    }
  }

  function atualizarFicha(campo, valor) {
    setForm((f) => ({ ...f, ficha_medica: { ...f.ficha_medica, [campo]: valor } }));
  }
  function atualizarParQ(pergunta, valor) {
    setForm((f) => ({ ...f, ficha_medica: { ...f.ficha_medica, par_q: { ...f.ficha_medica?.par_q, [pergunta]: valor } } }));
  }
  function atualizarCondicao(condicao, valor) {
    setForm((f) => ({
      ...f,
      ficha_medica: { ...f.ficha_medica, condicoes: { ...f.ficha_medica?.condicoes, [condicao]: valor } },
    }));
  }
  function atualizarAtestado(campo, valor) {
    setForm((f) => ({
      ...f,
      ficha_medica: { ...f.ficha_medica, atestado: { ...f.ficha_medica?.atestado, [campo]: valor } },
    }));
  }

  const resumoFinanceiro = useMemo(() => {
    const pagas = mensalidades.filter((m) => m.status === 'pago');
    const totalPago = pagas.reduce((s, m) => s + Number(m.valor), 0);
    const pendentes = mensalidades.filter((m) => m.status === 'em_aberto' || m.status === 'atrasado');
    const totalPendente = pendentes.reduce((s, m) => s + Number(m.valor), 0);
    const atrasadasHistorico = mensalidades.filter((m) => m.status === 'atrasado').length;
    return {
      totalPago,
      totalPendente,
      atrasadasHistorico,
      ticketMedio: pagas.length > 0 ? totalPago / pagas.length : 0,
    };
  }, [mensalidades]);

  const fichaMedicaAtual = editando ? form.ficha_medica : { ...FICHA_MEDICA_VAZIA, ...(aluno?.ficha_medica || {}) };
  const temAlertaParQ = Object.values(fichaMedicaAtual?.par_q || {}).some(Boolean);

  if (carregando) return <p className="text-steel-400 text-sm">Carregando...</p>;
  if (!aluno) return <p className="text-steel-400 text-sm">Aluno não encontrado.</p>;

  return (
    <div>
      <button
        onClick={() => navigate('/alunos')}
        className="flex items-center gap-1.5 text-steel-400 hover:text-white text-sm mb-6"
      >
        <ArrowLeft size={16} /> Voltar para alunos
      </button>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 group">
            {aluno.foto_url ? (
              <img src={aluno.foto_url} alt={aluno.nome} className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-graphite-800 flex items-center justify-center font-display text-xl font-semibold text-ember-400">
                {aluno.nome?.slice(0, 2).toUpperCase()}
              </div>
            )}
            {podeGerenciar && !enviandoFoto && (
              <label
                htmlFor="upload-foto"
                className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/50 flex items-center justify-center cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                title="Trocar foto"
              >
                <Camera size={18} className="text-white" />
              </label>
            )}
            {podeGerenciar && (
              <input id="upload-foto" type="file" accept="image/*" className="hidden" onChange={handleUploadFoto} />
            )}
            {enviandoFoto && (
              <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                <Loader2 size={18} className="text-white animate-spin" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-white">{aluno.nome}</h1>
              {aluno.bloqueado && (
                <span
                  title={aluno.motivo_bloqueio}
                  className="text-xs font-medium px-2 py-1 rounded-full bg-rose-500/15 text-rose-400"
                >
                  Bloqueado na catraca · {aluno.motivo_bloqueio}
                </span>
              )}
            </div>
            <p className="text-steel-400 text-sm">{aluno.cpf}</p>
          </div>
        </div>

        {podeGerenciar &&
          (!editando ? (
            <button
              onClick={() => setEditando(true)}
              className="flex items-center gap-2 text-sm font-medium text-steel-300 hover:text-white border border-graphite-700 hover:bg-graphite-800 px-4 py-2 rounded-lg"
            >
              <Pencil size={14} /> Editar perfil
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setForm({ ...aluno, ficha_medica: { ...FICHA_MEDICA_VAZIA, ...(aluno.ficha_medica || {}) } });
                  setEditando(false);
                }}
                className="flex items-center gap-2 text-sm font-medium text-steel-300 hover:bg-graphite-800 px-4 py-2 rounded-lg"
              >
                <X size={14} /> Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="flex items-center gap-2 text-sm font-medium bg-ember-500 hover:bg-ember-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
              >
                <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          ))}
      </div>

      <div className="flex gap-1 border-b border-graphite-800 mb-6">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              abaAtiva === aba.id ? 'border-ember-500 text-white' : 'border-transparent text-steel-400 hover:text-white'
            }`}
          >
            {aba.label}
            {aba.id === 'medica' && temAlertaParQ && <span className="ml-1.5 text-amber-400">●</span>}
          </button>
        ))}
      </div>

      {/* ===================== ABA GERAL ===================== */}
      {abaAtiva === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-4">Contato</h3>
            {!editando ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-steel-300">
                  <Mail size={14} className="text-steel-500" /> {aluno.email || '-'}
                </div>
                <div className="flex items-center gap-2 text-steel-300">
                  <Phone size={14} className="text-steel-500" /> {aluno.telefone || '-'}
                </div>
                <div className="flex items-start gap-2 text-steel-300">
                  <MapPin size={14} className="text-steel-500 mt-0.5" />
                  <span>
                    {[aluno.endereco, aluno.numero, aluno.bairro, aluno.cidade, aluno.estado]
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </span>
                </div>
                {aluno.codigo_dispositivo && (
                  <div className="flex items-center gap-2 text-steel-500 text-xs pt-1">
                    <Fingerprint size={13} /> Código no leitor biométrico: {aluno.codigo_dispositivo}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <input className={inputClasse} placeholder="E-mail" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className={inputClasse} placeholder="Telefone" value={form.telefone || ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClasse} placeholder="Endereço" value={form.endereco || ''} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
                  <input className={inputClasse} placeholder="Número" value={form.numero || ''} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
                  <input className={inputClasse} placeholder="Bairro" value={form.bairro || ''} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
                  <input className={inputClasse} placeholder="Cidade" value={form.cidade || ''} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                </div>
                <div>
                  <input
                    className={inputClasse}
                    placeholder="Código no leitor biométrico (só se necessário)"
                    value={form.codigo_dispositivo || ''}
                    onChange={(e) => setForm({ ...form, codigo_dispositivo: e.target.value })}
                  />
                  <p className="text-steel-500 text-xs mt-1">
                    Só preencha se o leitor facial/biométrico identificar por um código numérico diferente do CPF. Veja em Controle de Acesso → Configurar catraca.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-4">Dados pessoais</h3>
            {!editando ? (
              <div className="space-y-2 text-sm text-steel-300">
                <p><span className="text-steel-500">Nascimento:</span> {formatarData(aluno.data_nascimento)}</p>
                <p><span className="text-steel-500">Sexo:</span> {aluno.sexo || '-'}</p>
                <p><span className="text-steel-500">CEP:</span> {aluno.cep || '-'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input type="date" className={inputClasse} value={form.data_nascimento || ''} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
                <select className={inputClasse} value={form.sexo || ''} onChange={(e) => setForm({ ...form, sexo: e.target.value })}>
                  <option value="">Sexo (não informado)</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="outro">Outro</option>
                </select>
                <input className={inputClasse} placeholder="CEP" value={form.cep || ''} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== ABA FICHA MÉDICA ===================== */}
      {abaAtiva === 'medica' && (
        <div className="space-y-4">
          {temAlertaParQ && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                Uma ou mais respostas do PAR-Q indicam a necessidade de avaliação médica antes do treino. Confirme se
                o aluno já apresentou atestado.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                <HeartPulse size={13} /> Dados físicos
              </h3>
              {!editando ? (
                <div className="space-y-2 text-sm text-steel-300">
                  <p><span className="text-steel-500">Peso:</span> {aluno.peso_kg ? `${aluno.peso_kg} kg` : '-'}</p>
                  <p><span className="text-steel-500">Altura:</span> {aluno.altura_cm ? `${aluno.altura_cm} cm` : '-'}</p>
                  <p><span className="text-steel-500">Objetivo:</span> {aluno.objetivo || '-'}</p>
                  <p><span className="text-steel-500">Tipo sanguíneo:</span> {aluno.ficha_medica?.tipo_sanguineo || '-'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" className={inputClasse} placeholder="Peso (kg)" value={form.peso_kg || ''} onChange={(e) => setForm({ ...form, peso_kg: e.target.value })} />
                    <input type="number" className={inputClasse} placeholder="Altura (cm)" value={form.altura_cm || ''} onChange={(e) => setForm({ ...form, altura_cm: e.target.value })} />
                  </div>
                  <input className={inputClasse} placeholder="Objetivo" value={form.objetivo || ''} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
                  <select className={inputClasse} value={form.ficha_medica?.tipo_sanguineo || ''} onChange={(e) => atualizarFicha('tipo_sanguineo', e.target.value)}>
                    <option value="">Tipo sanguíneo (não informado)</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-4">Condições pré-existentes</h3>
              {!editando ? (
                <div className="flex flex-wrap gap-2 mb-2">
                  {CONDICOES_PREEXISTENTES.filter((c) => aluno.ficha_medica?.condicoes?.[c.id]).map((c) => (
                    <span key={c.id} className="text-xs font-medium px-2 py-1 rounded-full bg-rose-500/15 text-rose-400">{c.label}</span>
                  ))}
                  {!CONDICOES_PREEXISTENTES.some((c) => aluno.ficha_medica?.condicoes?.[c.id]) && (
                    <span className="text-steel-500 text-sm">Nenhuma condição registrada.</span>
                  )}
                  {aluno.ficha_medica?.condicao_outra && (
                    <p className="text-steel-300 text-sm w-full mt-1">Outra: {aluno.ficha_medica.condicao_outra}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3">
                    {CONDICOES_PREEXISTENTES.map((c) => (
                      <label key={c.id} className="flex items-center gap-1.5 text-sm text-steel-300">
                        <input
                          type="checkbox"
                          checked={Boolean(form.ficha_medica?.condicoes?.[c.id])}
                          onChange={(e) => atualizarCondicao(c.id, e.target.checked)}
                          className="rounded border-graphite-700 bg-graphite-800 text-ember-500 focus:ring-ember-500"
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                  <input className={inputClasse} placeholder="Outra condição" value={form.ficha_medica?.condicao_outra || ''} onChange={(e) => atualizarFicha('condicao_outra', e.target.value)} />
                </div>
              )}
            </div>
          </div>

          <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-4">
              PAR-Q · Questionário de prontidão para atividade física
            </h3>
            <div className="space-y-3">
              {PERGUNTAS_PARQ.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-steel-300">{p.texto}</span>
                  {!editando ? (
                    <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${aluno.ficha_medica?.par_q?.[p.id] ? 'bg-rose-500/15 text-rose-400' : 'bg-mint-500/15 text-mint-400'}`}>
                      {aluno.ficha_medica?.par_q?.[p.id] ? 'Sim' : 'Não'}
                    </span>
                  ) : (
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => atualizarParQ(p.id, false)} className={`px-2.5 py-1 rounded-md text-xs font-medium ${!form.ficha_medica?.par_q?.[p.id] ? 'bg-mint-500 text-graphite-950' : 'bg-graphite-800 text-steel-400'}`}>Não</button>
                      <button type="button" onClick={() => atualizarParQ(p.id, true)} className={`px-2.5 py-1 rounded-md text-xs font-medium ${form.ficha_medica?.par_q?.[p.id] ? 'bg-rose-500 text-white' : 'bg-graphite-800 text-steel-400'}`}>Sim</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-4">Medicação, alergias e cirurgias</h3>
              {!editando ? (
                <div className="space-y-2 text-sm text-steel-300">
                  <p><span className="text-steel-500">Medicação contínua:</span> {aluno.ficha_medica?.medicamentos_uso_continuo || '-'}</p>
                  <p><span className="text-steel-500">Alergias:</span> {aluno.ficha_medica?.alergias || '-'}</p>
                  <p><span className="text-steel-500">Cirurgias recentes:</span> {aluno.ficha_medica?.cirurgias_recentes || '-'}</p>
                  <p><span className="text-steel-500">Outras observações:</span> {aluno.observacoes_medicas || '-'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <input className={inputClasse} placeholder="Medicação de uso contínuo" value={form.ficha_medica?.medicamentos_uso_continuo || ''} onChange={(e) => atualizarFicha('medicamentos_uso_continuo', e.target.value)} />
                  <input className={inputClasse} placeholder="Alergias" value={form.ficha_medica?.alergias || ''} onChange={(e) => atualizarFicha('alergias', e.target.value)} />
                  <input className={inputClasse} placeholder="Cirurgias recentes" value={form.ficha_medica?.cirurgias_recentes || ''} onChange={(e) => atualizarFicha('cirurgias_recentes', e.target.value)} />
                  <textarea className={inputClasse} rows={2} placeholder="Outras observações médicas" value={form.observacoes_medicas || ''} onChange={(e) => setForm({ ...form, observacoes_medicas: e.target.value })} />
                </div>
              )}
            </div>

            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-4">Atestado médico</h3>
              {!editando ? (
                <div className="space-y-2 text-sm text-steel-300">
                  <p><span className="text-steel-500">Situação:</span> {
                    { apto: 'Apto', apto_restricao: 'Apto com restrição', inapto: 'Inapto' }[aluno.ficha_medica?.atestado?.status] || 'Não avaliado'
                  }</p>
                  <p><span className="text-steel-500">Emissão:</span> {formatarData(aluno.ficha_medica?.atestado?.data_emissao)}</p>
                  <p><span className="text-steel-500">Validade:</span> {formatarData(aluno.ficha_medica?.atestado?.validade)}</p>
                  <p><span className="text-steel-500">Médico:</span> {aluno.ficha_medica?.atestado?.medico_nome || '-'} {aluno.ficha_medica?.atestado?.medico_crm && `(CRM ${aluno.ficha_medica.atestado.medico_crm})`}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <select className={inputClasse} value={form.ficha_medica?.atestado?.status || ''} onChange={(e) => atualizarAtestado('status', e.target.value)}>
                    <option value="">Situação (não avaliado)</option>
                    <option value="apto">Apto</option>
                    <option value="apto_restricao">Apto com restrição</option>
                    <option value="inapto">Inapto</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" className={inputClasse} value={form.ficha_medica?.atestado?.data_emissao || ''} onChange={(e) => atualizarAtestado('data_emissao', e.target.value)} />
                    <input type="date" className={inputClasse} value={form.ficha_medica?.atestado?.validade || ''} onChange={(e) => atualizarAtestado('validade', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClasse} placeholder="Nome do médico" value={form.ficha_medica?.atestado?.medico_nome || ''} onChange={(e) => atualizarAtestado('medico_nome', e.target.value)} />
                    <input className={inputClasse} placeholder="CRM" value={form.ficha_medica?.atestado?.medico_crm || ''} onChange={(e) => atualizarAtestado('medico_crm', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-4">Contato de emergência</h3>
            {!editando ? (
              <p className="text-sm text-steel-300">
                {aluno.contato_emergencia_nome || '-'} {aluno.contato_emergencia_telefone && `· ${aluno.contato_emergencia_telefone}`}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input className={inputClasse} placeholder="Nome" value={form.contato_emergencia_nome || ''} onChange={(e) => setForm({ ...form, contato_emergencia_nome: e.target.value })} />
                <input className={inputClasse} placeholder="Telefone" value={form.contato_emergencia_telefone || ''} onChange={(e) => setForm({ ...form, contato_emergencia_telefone: e.target.value })} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== ABA FINANCEIRO ===================== */}
      {abaAtiva === 'financeiro' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-4">
              <p className="text-steel-400 text-xs font-medium mb-1 flex items-center gap-1"><TrendingUp size={12} /> Total pago</p>
              <p className="font-display text-lg font-semibold text-mint-400 tabular">{formatarMoeda(resumoFinanceiro.totalPago)}</p>
            </div>
            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-4">
              <p className="text-steel-400 text-xs font-medium mb-1 flex items-center gap-1"><TrendingDown size={12} /> Em aberto/atraso</p>
              <p className="font-display text-lg font-semibold text-rose-400 tabular">{formatarMoeda(resumoFinanceiro.totalPendente)}</p>
            </div>
            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-4">
              <p className="text-steel-400 text-xs font-medium mb-1 flex items-center gap-1"><Wallet size={12} /> Ticket médio</p>
              <p className="font-display text-lg font-semibold text-white tabular">{formatarMoeda(resumoFinanceiro.ticketMedio)}</p>
            </div>
            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-4">
              <p className="text-steel-400 text-xs font-medium mb-1 flex items-center gap-1"><Percent size={12} /> Desconto</p>
              <p className="font-display text-lg font-semibold text-white tabular">{aluno.desconto_percentual || 0}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-4">Condições financeiras</h3>
              {!editando ? (
                <div className="space-y-2 text-sm text-steel-300">
                  <p><span className="text-steel-500">Desconto aplicado:</span> {aluno.desconto_percentual || 0}%</p>
                  <p><span className="text-steel-500">Mensalidades atrasadas (histórico):</span> {resumoFinanceiro.atrasadasHistorico}</p>
                  <p><span className="text-steel-500">Observações:</span> {aluno.observacoes_financeiras || '-'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Campo label="Desconto (%)">
                    <input type="number" min={0} max={100} step="0.5" className={inputClasse} value={form.desconto_percentual ?? 0} onChange={(e) => setForm({ ...form, desconto_percentual: e.target.value })} />
                  </Campo>
                  <Campo label="Observações financeiras">
                    <textarea className={inputClasse} rows={3} placeholder="ex: paga sempre no débito, parcelamento combinado..." value={form.observacoes_financeiras || ''} onChange={(e) => setForm({ ...form, observacoes_financeiras: e.target.value })} />
                  </Campo>
                </div>
              )}
            </div>

            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-ember-400 uppercase tracking-wide mb-4">Responsável financeiro</h3>
              <p className="text-steel-500 text-xs mb-3">Preencha se quem paga a mensalidade não é o próprio aluno (ex: pai/mãe de aluno menor de idade).</p>
              {!editando ? (
                <div className="space-y-2 text-sm text-steel-300">
                  <p><span className="text-steel-500">Nome:</span> {aluno.responsavel_financeiro_nome || '-'}</p>
                  <p><span className="text-steel-500">CPF:</span> {aluno.responsavel_financeiro_cpf || '-'}</p>
                  <p><span className="text-steel-500">Telefone:</span> {aluno.responsavel_financeiro_telefone || '-'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <input className={inputClasse} placeholder="Nome do responsável" value={form.responsavel_financeiro_nome || ''} onChange={(e) => setForm({ ...form, responsavel_financeiro_nome: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClasse} placeholder="CPF" value={form.responsavel_financeiro_cpf || ''} onChange={(e) => setForm({ ...form, responsavel_financeiro_cpf: e.target.value })} />
                    <input className={inputClasse} placeholder="Telefone" value={form.responsavel_financeiro_telefone || ''} onChange={(e) => setForm({ ...form, responsavel_financeiro_telefone: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
            <h3 className="font-display font-semibold text-white mb-4">Matrículas</h3>
            {matriculas.length === 0 ? (
              <p className="text-steel-500 text-sm">Nenhuma matrícula registrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {matriculas.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2.5 border-b border-graphite-800 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-white">{m.planos?.nome}</p>
                      <p className="text-xs text-steel-500">{formatarData(m.data_inicio)} até {formatarData(m.data_fim) || 'indeterminado'}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${BADGES_MATRICULA[m.status] || BADGES_MATRICULA.pendente}`}>{m.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-white flex items-center gap-1.5">
                <Receipt size={16} /> Histórico de mensalidades
              </h3>
              {temPermissao(funcionario, 'mensalidades', 'gerenciar') && (
                <Link to="/mensalidades/novo-carne" className="text-ember-400 text-sm font-medium hover:text-ember-300">
                  + Gerar carnê
                </Link>
              )}
            </div>
            {mensalidades.length === 0 ? (
              <p className="text-steel-500 text-sm">Nenhuma mensalidade gerada para este aluno.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-steel-500 text-xs">
                    <th className="font-medium pb-2">Parcela</th>
                    <th className="font-medium pb-2">Vencimento</th>
                    <th className="font-medium pb-2">Valor</th>
                    <th className="font-medium pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mensalidades.map((m) => (
                    <tr key={m.id} className="border-t border-graphite-800">
                      <td className="py-2.5 text-steel-300">{m.numero_parcela}/{m.total_parcelas}</td>
                      <td className="py-2.5 text-steel-300">{formatarData(m.data_vencimento)}</td>
                      <td className="py-2.5 text-steel-300 tabular">{formatarMoeda(m.valor)}</td>
                      <td className="py-2.5">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${BADGES_MENSALIDADE[m.status] || BADGES_MENSALIDADE.em_aberto}`}>
                          {m.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
