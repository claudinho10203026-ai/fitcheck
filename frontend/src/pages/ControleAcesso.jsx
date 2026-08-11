import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Fingerprint,
  LogIn,
  LogOut,
  Users,
  ShieldAlert,
  ShieldCheck,
  Search,
  KeyRound,
  Copy,
  RefreshCw,
  Plus,
  X,
  Trash2,
  Pencil,
  Settings,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { temPermissao } from '../lib/permissoes';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function formatarHora(data) {
  return new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function limparCpf(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function formatarCpf(cpf) {
  const v = limparCpf(cpf);
  if (v.length !== 11) return cpf || '';
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
}

const MARCAS = [
  { valor: 'control_id', label: 'Control iD' },
  { valor: 'intelbras', label: 'Intelbras' },
  { valor: 'topdata', label: 'Topdata' },
  { valor: 'henry', label: 'Henry' },
  { valor: 'zkteco', label: 'ZKTeco' },
  { valor: 'outra', label: 'Outra / não sei ainda' },
];

function nomeMarca(valor) {
  return MARCAS.find((m) => m.valor === valor)?.label || 'Outra';
}

// ----------------------------------------------------------------------------
// Pequenos componentes visuais
// ----------------------------------------------------------------------------

function StatCard({ icone: Icone, label, valor, cor }) {
  return (
    <div className="bg-graphite-900 border border-graphite-800 rounded-xl p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${cor}`}>
        <Icone size={20} />
      </div>
      <div>
        <p className="text-2xl font-display font-semibold text-white leading-tight">{valor}</p>
        <p className="text-steel-400 text-sm">{label}</p>
      </div>
    </div>
  );
}

function BadgeLiberado({ liberado }) {
  return liberado ? (
    <span className="inline-flex items-center gap-1 bg-mint-500/10 text-mint-400 border border-mint-500/20 px-2 py-0.5 rounded-full text-xs font-medium">
      <CheckCircle2 size={12} /> Permitido
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full text-xs font-medium">
      <XCircle size={12} /> Negado
    </span>
  );
}

function BadgeTipo({ tipo }) {
  return tipo === 'entrada' ? (
    <span className="inline-flex items-center gap-1 text-steel-300 text-xs">
      <LogIn size={12} /> Entrada
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-steel-300 text-xs">
      <LogOut size={12} /> Saída
    </span>
  );
}

// ----------------------------------------------------------------------------
// Instruções específicas por marca de catraca
// ----------------------------------------------------------------------------

function InstrucoesMarca({ marca, url, chave }) {
  const comum = (
    <div className="bg-graphite-950 border border-graphite-800 rounded-lg p-3 mb-3 font-mono text-xs text-steel-300 break-all">
      <p className="text-steel-500 mb-1">URL de verificação:</p>
      <p className="text-mint-400">{url}</p>
      <p className="text-steel-500 mt-2 mb-1">Cabeçalho de autenticação:</p>
      <p className="text-amber-400">X-Chave-Integracao: {chave || '(gere a chave abaixo)'}</p>
    </div>
  );

  if (marca === 'control_id') {
    return (
      <div className="text-sm text-steel-300 space-y-2">
        {comum}
        <p>
          Equipamentos Control iD (iDFace, iDFace Max, iDAccess, iDAccess Web) costumam ter um recurso
          nativo de <strong className="text-white">validação externa</strong>: antes de liberar quem foi
          reconhecido por facial ou digital, o próprio equipamento consulta uma URL e só abre se receber
          "permitido".
        </p>
        <ol className="list-decimal list-inside space-y-1 text-steel-400">
          <li>Cadastre o CPF de cada aluno como o código/matrícula da pessoa no equipamento.</li>
          <li>No Configurador (ou na interface web do equipamento), procure por "Identificação" → "Validação externa" (o nome exato do menu pode variar por modelo/firmware).</li>
          <li>Configure a URL acima, enviando o identificador da pessoa no parâmetro <code>cpf</code>.</li>
          <li>Configure o cabeçalho/token de autenticação com a chave acima, se o seu modelo permitir header customizado.</li>
          <li>Teste com um aluno cadastrado — o acesso aparece no histórico abaixo em poucos segundos.</li>
        </ol>
        <p className="text-steel-500 text-xs">
          Os nomes exatos das telas variam por modelo/firmware — se algum passo não bater com o que você vê no seu equipamento, me avise com o modelo exato que eu ajusto o passo a passo.
        </p>
      </div>
    );
  }

  if (marca === 'intelbras') {
    return (
      <div className="text-sm text-steel-300 space-y-2">
        {comum}
        <p>
          Nos equipamentos Intelbras (linha SS, facial/biometria), o suporte a "validação online"
          (chamar uma URL externa antes de liberar) varia por modelo e versão de firmware — alguns
          suportam nativamente, outros só decidem localmente.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-steel-400">
          <li>Verifique com o instalador ou no manual do seu modelo se existe "validação online"/"webhook". Se existir, é a mesma lógica: aponta pra URL acima com o CPF cadastrado como identificador.</li>
          <li>Se o seu modelo não tiver essa opção nativa, use a "ponte" genérica que já deixei pronta no projeto (pasta <code>integracoes/ponte-catraca</code>) — ela já sabe conversar com este sistema; falta só ligar com o SDK específico do seu modelo Intelbras.</li>
        </ol>
        <p className="text-steel-500 text-xs">
          Me manda o modelo exato (ex: SS 5530, SS 3541) e, se tiver, o manual de integração — eu completo a ponte com o protocolo certo.
        </p>
      </div>
    );
  }

  // topdata, henry, zkteco, outra
  return (
    <div className="text-sm text-steel-300 space-y-2">
      {comum}
      <p>
        Não existe um protocolo único de catraca no Brasil — cada fabricante tem seu próprio SDK. O
        caminho depende do que o seu equipamento suporta:
      </p>
      <ol className="list-decimal list-inside space-y-1 text-steel-400">
        <li>Se o software/equipamento tiver alguma opção de "validação externa", "validação online" ou "webhook", aponte-a pra URL acima, enviando o CPF cadastrado como identificador.</li>
        <li>Se não tiver, use a "ponte" genérica em <code>integracoes/ponte-catraca</code> — ela já sabe conversar com este sistema; falta só ligar com o SDK do fabricante do seu equipamento (a parte que varia por marca).</li>
      </ol>
      <p className="text-steel-500 text-xs">
        Me diga a marca/modelo exato e, se tiver, o manual de integração/SDK — eu completo a ponte com o protocolo certo.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Modal de cadastro/edição de catraca
// ----------------------------------------------------------------------------

function ModalCatraca({ catraca, onFechar, onSalvo }) {
  const [form, setForm] = useState(
    catraca || { nome: '', marca: 'control_id', modelo: '', local: '', sentido_padrao: 'ambos', observacoes: '' }
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Dê um nome pra essa catraca.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      if (catraca?.id) {
        await api.put(`/acesso/catracas/${catraca.id}`, form);
      } else {
        await api.post('/acesso/catracas', form);
      }
      onSalvo();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar catraca.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-graphite-900 border border-graphite-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-white">
            {catraca?.id ? 'Editar catraca' : 'Nova catraca'}
          </h3>
          <button onClick={onFechar} className="text-steel-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={salvar} className="space-y-3">
          <div>
            <label className="text-sm text-steel-400 block mb-1">Nome *</label>
            <input
              autoFocus
              className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white placeholder-steel-500 focus:outline-none focus:border-ember-500"
              placeholder="Ex: Catraca Entrada Principal"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-steel-400 block mb-1">Marca</label>
            <select
              className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-ember-500"
              value={form.marca}
              onChange={(e) => setForm({ ...form, marca: e.target.value })}
            >
              {MARCAS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-steel-400 block mb-1">Modelo</label>
              <input
                className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white placeholder-steel-500 focus:outline-none focus:border-ember-500"
                placeholder="Ex: iDFace Max"
                value={form.modelo || ''}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-steel-400 block mb-1">Local</label>
              <input
                className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white placeholder-steel-500 focus:outline-none focus:border-ember-500"
                placeholder="Ex: Recepção"
                value={form.local || ''}
                onChange={(e) => setForm({ ...form, local: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-steel-400 block mb-1">Sentido</label>
            <select
              className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-ember-500"
              value={form.sentido_padrao}
              onChange={(e) => setForm({ ...form, sentido_padrao: e.target.value })}
            >
              <option value="ambos">Entrada e saída</option>
              <option value="entrada">Só entrada</option>
              <option value="saida">Só saída</option>
            </select>
          </div>
          {erro && <p className="text-rose-400 text-sm">{erro}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 bg-graphite-800 hover:bg-graphite-700 text-steel-300 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 bg-ember-500 hover:bg-ember-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Seção "Configurar catraca" (admin/gerenciar)
// ----------------------------------------------------------------------------

function SecaoConfigurarCatraca({ podeGerenciar }) {
  const [aberto, setAberto] = useState(true);
  const [chave, setChave] = useState(null);
  const [gerandoChave, setGerandoChave] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [catracas, setCatracas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(null); // null | {} | catraca
  const [expandidoId, setExpandidoId] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const [{ data: chaveData }, { data: catracasData }] = await Promise.all([
        api.get('/acesso/chave'),
        api.get('/acesso/catracas'),
      ]);
      setChave(chaveData.chave);
      setCatracas(catracasData);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function gerarChave() {
    if (chave && !window.confirm('Gerar uma nova chave invalida a atual em todas as catracas já configuradas. Continuar?')) {
      return;
    }
    setGerandoChave(true);
    try {
      const { data } = await api.post('/acesso/chave/gerar');
      setChave(data.chave);
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao gerar chave.');
    } finally {
      setGerandoChave(false);
    }
  }

  function copiarChave() {
    navigator.clipboard.writeText(chave);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  async function removerCatraca(catraca) {
    if (!window.confirm(`Remover "${catraca.nome}"? Isso não apaga o histórico de acessos já registrado.`)) return;
    try {
      await api.delete(`/acesso/catracas/${catraca.id}`);
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao remover catraca.');
    }
  }

  function urlParaCatraca(catraca) {
    const sentido = catraca.sentido_padrao !== 'ambos' ? catraca.sentido_padrao : 'entrada';
    return `${API_URL}/acesso/verificar?cpf=00000000000&sentido=${sentido}&dispositivo=${encodeURIComponent(catraca.nome)}`;
  }

  if (!podeGerenciar) return null;

  return (
    <div className="bg-graphite-900 border border-graphite-800 rounded-xl">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between p-5"
      >
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-steel-400" />
          <h2 className="font-display text-lg font-semibold text-white">Configurar catraca</h2>
        </div>
        {aberto ? <ChevronUp size={18} className="text-steel-400" /> : <ChevronDown size={18} className="text-steel-400" />}
      </button>

      {aberto && (
        <div className="px-5 pb-5 space-y-5">
          {/* Chave de integração */}
          <div className="bg-graphite-950 border border-graphite-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound size={16} className="text-amber-400" />
              <p className="text-sm font-medium text-white">Chave de integração da academia</p>
            </div>
            <p className="text-steel-400 text-xs mb-3">
              É o "token" que autentica as catracas com este sistema. A mesma chave serve pra todas as
              catracas desta academia.
            </p>
            {carregando ? (
              <p className="text-steel-500 text-sm">Carregando...</p>
            ) : chave ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-graphite-900 border border-graphite-700 rounded-lg px-3 py-2 text-mint-400 text-sm break-all">
                  {chave}
                </code>
                <button
                  onClick={copiarChave}
                  className="bg-graphite-800 hover:bg-graphite-700 text-steel-300 p-2 rounded-lg transition-colors"
                  title="Copiar"
                >
                  {copiado ? <CheckCircle2 size={16} className="text-mint-400" /> : <Copy size={16} />}
                </button>
                <button
                  onClick={gerarChave}
                  disabled={gerandoChave}
                  className="bg-graphite-800 hover:bg-graphite-700 text-steel-300 p-2 rounded-lg transition-colors"
                  title="Gerar nova chave"
                >
                  <RefreshCw size={16} className={gerandoChave ? 'animate-spin' : ''} />
                </button>
              </div>
            ) : (
              <button
                onClick={gerarChave}
                disabled={gerandoChave}
                className="bg-ember-500 hover:bg-ember-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                {gerandoChave ? 'Gerando...' : 'Gerar chave de integração'}
              </button>
            )}
          </div>

          {/* Lista de catracas cadastradas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white">Catracas cadastradas</p>
              <button
                onClick={() => setModal({})}
                className="flex items-center gap-1 text-ember-400 hover:text-ember-300 text-sm font-medium"
              >
                <Plus size={16} /> Adicionar catraca
              </button>
            </div>

            {catracas.length === 0 ? (
              <p className="text-steel-500 text-sm">Nenhuma catraca cadastrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {catracas.map((c) => (
                  <div key={c.id} className="bg-graphite-950 border border-graphite-800 rounded-lg">
                    <div className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-white text-sm font-medium">{c.nome}</p>
                        <p className="text-steel-500 text-xs">
                          {nomeMarca(c.marca)}
                          {c.modelo ? ` · ${c.modelo}` : ''}
                          {c.local ? ` · ${c.local}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setExpandidoId(expandidoId === c.id ? null : c.id)}
                          className="text-steel-400 hover:text-white text-xs px-2 py-1 rounded"
                        >
                          {expandidoId === c.id ? 'Ocultar' : 'Ver instruções'}
                        </button>
                        <button onClick={() => setModal(c)} className="text-steel-400 hover:text-white p-1.5">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => removerCatraca(c)} className="text-steel-400 hover:text-rose-400 p-1.5">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {expandidoId === c.id && (
                      <div className="border-t border-graphite-800 p-4">
                        <InstrucoesMarca marca={c.marca} url={urlParaCatraca(c)} chave={chave} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {modal && (
        <ModalCatraca
          catraca={modal.id ? modal : null}
          onFechar={() => setModal(null)}
          onSalvo={() => {
            setModal(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Painel de checagem/liberação manual
// ----------------------------------------------------------------------------

function PainelChecagemManual({ podeGerenciar, onRegistrado }) {
  const [cpf, setCpf] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erroConsulta, setErroConsulta] = useState('');
  const [registrando, setRegistrando] = useState(null); // 'entrada' | 'saida' | null
  const [mensagem, setMensagem] = useState(null);

  async function consultar(e) {
    e.preventDefault();
    const limpo = limparCpf(cpf);
    if (!limpo) return;
    setConsultando(true);
    setErroConsulta('');
    setResultado(null);
    setMensagem(null);
    try {
      const { data } = await api.get('/acesso/verificar-interno', { params: { cpf: limpo } });
      setResultado(data);
    } catch (err) {
      setErroConsulta(err.response?.data?.erro || 'Erro ao consultar.');
    } finally {
      setConsultando(false);
    }
  }

  async function registrar(tipo, forcar = false) {
    if (forcar) {
      const ok = window.confirm(
        `Este aluno está bloqueado (${resultado?.motivo}). Confirma a liberação manual mesmo assim? Isso fica registrado no histórico com seu nome.`
      );
      if (!ok) return;
    }
    setRegistrando(tipo);
    setMensagem(null);
    try {
      const { data } = await api.post('/acesso/registrar', { cpf: limparCpf(cpf), tipo, forcar });
      setMensagem({
        ok: data.liberado,
        texto: data.liberado
          ? `${tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada para ${data.aluno?.nome}.`
          : `Não liberado: ${data.motivo}`,
      });
      if (data.liberado) {
        setResultado(null);
        setCpf('');
      }
      onRegistrado();
    } catch (err) {
      setMensagem({ ok: false, texto: err.response?.data?.erro || 'Erro ao registrar acesso.' });
    } finally {
      setRegistrando(null);
    }
  }

  return (
    <div className="bg-graphite-900 border border-graphite-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Fingerprint size={18} className="text-steel-400" />
        <h2 className="font-display text-lg font-semibold text-white">Liberação manual</h2>
      </div>
      <p className="text-steel-400 text-xs mb-4">
        Use pra registrar entrada/saída sem catraca, ou como conferência antes da pessoa passar.
      </p>

      <form onSubmit={consultar} className="flex gap-2 mb-3">
        <input
          className="flex-1 bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white placeholder-steel-500 focus:outline-none focus:border-ember-500"
          placeholder="CPF do aluno"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
        />
        <button
          type="submit"
          disabled={consultando}
          className="bg-graphite-800 hover:bg-graphite-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Search size={16} /> {consultando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {erroConsulta && <p className="text-rose-400 text-sm mb-3">{erroConsulta}</p>}

      {resultado && (
        <div className="bg-graphite-950 border border-graphite-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{resultado.aluno?.nome}</p>
              <p className="text-steel-500 text-xs">{formatarCpf(cpf)}</p>
            </div>
            <BadgeLiberado liberado={resultado.liberado} />
          </div>
          {!resultado.liberado && <p className="text-rose-400 text-sm">Motivo: {resultado.motivo}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => registrar('entrada', !resultado.liberado)}
              disabled={registrando !== null || (!resultado.liberado && !podeGerenciar)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                resultado.liberado ? 'bg-mint-500/10 text-mint-400 hover:bg-mint-500/20 border border-mint-500/20' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
              }`}
            >
              <LogIn size={15} /> {resultado.liberado ? 'Registrar entrada' : 'Liberar entrada mesmo assim'}
            </button>
            <button
              onClick={() => registrar('saida', !resultado.liberado)}
              disabled={registrando !== null || (!resultado.liberado && !podeGerenciar)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 bg-graphite-800 text-steel-300 hover:bg-graphite-700"
            >
              <LogOut size={15} /> Registrar saída
            </button>
          </div>
          {!resultado.liberado && !podeGerenciar && (
            <p className="text-steel-500 text-xs">Só quem tem permissão de gerenciar o Controle de Acesso pode liberar um aluno bloqueado.</p>
          )}
        </div>
      )}

      {mensagem && (
        <p className={`text-sm mt-3 ${mensagem.ok ? 'text-mint-400' : 'text-rose-400'}`}>{mensagem.texto}</p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Página principal
// ----------------------------------------------------------------------------

export default function ControleAcesso() {
  const { funcionario } = useAuth();
  const podeGerenciar = temPermissao(funcionario, 'acesso', 'gerenciar');

  const [presentes, setPresentes] = useState([]);
  const [bloqueados, setBloqueados] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [totalHoje, setTotalHoje] = useState(0);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const intervaloRef = useRef(null);

  const carregarListas = useCallback(async () => {
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const [presentesRes, bloqueadosRes, historicoRes] = await Promise.all([
        api.get('/acesso/presentes'),
        api.get('/acesso/bloqueados'),
        api.get('/acesso/historico', { params: { data: hoje, limit: 40 } }),
      ]);
      setPresentes(presentesRes.data);
      setBloqueados(bloqueadosRes.data);
      setHistorico(historicoRes.data.registros);
      setTotalHoje(historicoRes.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregandoInicial(false);
    }
  }, []);

  useEffect(() => {
    carregarListas();
    intervaloRef.current = setInterval(carregarListas, 10000);
    return () => clearInterval(intervaloRef.current);
  }, [carregarListas]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-white">Controle de Acesso</h1>
        <p className="text-steel-400 text-sm mt-1">Entrada e saída de alunos, liberação e catracas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icone={Users} label="Na academia agora" valor={presentes.length} cor="bg-mint-500/10 text-mint-400" />
        <StatCard icone={ShieldAlert} label="Bloqueados agora" valor={bloqueados.length} cor="bg-rose-500/10 text-rose-400" />
        <StatCard icone={ShieldCheck} label="Acessos hoje" valor={totalHoje} cor="bg-amber-500/10 text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1">
          <PainelChecagemManual podeGerenciar={podeGerenciar} onRegistrado={carregarListas} />
        </div>

        <div className="lg:col-span-2 bg-graphite-900 border border-graphite-800 rounded-xl p-5">
          <h2 className="font-display text-lg font-semibold text-white mb-4">Últimos acessos (hoje)</h2>
          {carregandoInicial ? (
            <p className="text-steel-500 text-sm">Carregando...</p>
          ) : historico.length === 0 ? (
            <p className="text-steel-500 text-sm">Nenhum acesso registrado hoje ainda.</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-steel-500 text-xs border-b border-graphite-800">
                    <th className="text-left font-medium px-5 py-2">Hora</th>
                    <th className="text-left font-medium px-5 py-2">Aluno</th>
                    <th className="text-left font-medium px-5 py-2">Tipo</th>
                    <th className="text-left font-medium px-5 py-2">Status</th>
                    <th className="text-left font-medium px-5 py-2">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id} className="border-b border-graphite-800/50">
                      <td className="px-5 py-2 text-steel-400">{formatarHora(h.created_at)}</td>
                      <td className="px-5 py-2 text-white">{h.alunos?.nome || h.cpf_informado || '—'}</td>
                      <td className="px-5 py-2">
                        <BadgeTipo tipo={h.tipo} />
                      </td>
                      <td className="px-5 py-2">
                        <BadgeLiberado liberado={h.liberado} />
                        {!h.liberado && h.motivo && <span className="text-steel-500 text-xs ml-2">{h.motivo}</span>}
                      </td>
                      <td className="px-5 py-2 text-steel-500 text-xs">
                        {h.origem === 'catraca' ? h.dispositivo || 'Catraca' : 'Manual'}
                        {h.forcado && <span className="text-amber-400"> · forçado</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {bloqueados.length > 0 && (
        <div className="bg-graphite-900 border border-graphite-800 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert size={18} className="text-rose-400" />
            <h2 className="font-display text-lg font-semibold text-white">Alunos bloqueados agora</h2>
          </div>
          <div className="space-y-2">
            {bloqueados.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-graphite-950 border border-graphite-800 rounded-lg px-4 py-2.5">
                <div>
                  <p className="text-white text-sm font-medium">{a.nome}</p>
                  <p className="text-steel-500 text-xs">{formatarCpf(a.cpf)}</p>
                </div>
                <span className="text-rose-400 text-xs">{a.motivo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SecaoConfigurarCatraca podeGerenciar={podeGerenciar} />
    </div>
  );
}
