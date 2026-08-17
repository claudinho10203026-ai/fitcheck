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

// Mesma lógica do lib/api.js: sem VITE_API_URL definida, usa a própria
// origem do navegador + /api (funciona tanto quando o backend serve o
// frontend junto quanto em desenvolvimento, via proxy do Vite).
const API_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

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
  { valor: 'evo', label: 'EVO (Evo Sistemas Inteligentes)' },
  { valor: 'topdata', label: 'Topdata' },
  { valor: 'henry', label: 'Henry' },
  { valor: 'zkteco', label: 'ZKTeco' },
  { valor: 'outra', label: 'Outra / não sei ainda' },
];

// Marcas que, pelo que a gente sabe hoje, tendem a NÃO ter a opção de
// "validação externa" (perguntar antes de abrir) - o normal nelas é
// funcionar por IP local ou empurrar (avisar depois). Isso só decide o
// tipo de conexão sugerido por padrão ao trocar a marca no formulário; o
// usuário pode mudar manualmente se souber que o modelo dele é diferente.
const MARCAS_PROVAVELMENTE_IP_LOCAL = ['evo', 'zkteco', 'topdata', 'henry'];

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

function InstrucoesMarca({ marca, tipoConexao, url, chave }) {
  const origemServidor = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return url;
    }
  })();

  const comum = (
    <div className="bg-graphite-950 border border-graphite-800 rounded-lg p-3 mb-3 font-mono text-xs text-steel-300 break-all">
      <p className="text-steel-500 mb-1">URL de verificação:</p>
      <p className="text-mint-400">{url}</p>
      <p className="text-steel-500 mt-2 mb-1">Cabeçalho de autenticação:</p>
      <p className="text-amber-400">X-Chave-Integracao: {chave || '(gere a chave abaixo)'}</p>
    </div>
  );

  // ---- Equipamento PERGUNTA ANTES de liberar (o ideal) ----
  if (tipoConexao === 'validacao_externa') {
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
    return (
      <div className="text-sm text-steel-300 space-y-2">
        {comum}
        <p>
          Procure no software/painel do equipamento por uma opção chamada algo como
          <strong className="text-white"> "validação externa"</strong>, <strong className="text-white">"validação online"</strong> ou
          <strong className="text-white"> "webhook"</strong> — geralmente em "Identificação" ou "Regras de acesso".
        </p>
        <ol className="list-decimal list-inside space-y-1 text-steel-400">
          <li>Cadastre o CPF de cada aluno como código/matrícula da pessoa no equipamento.</li>
          <li>Aponte essa opção pra URL acima, enviando o CPF cadastrado como identificador.</li>
          <li>Configure o cabeçalho/token de autenticação com a chave acima, se o equipamento permitir.</li>
        </ol>
        <p className="text-steel-500 text-xs">
          Me diga o modelo exato e, se tiver, o manual de integração — eu confirmo o passo a passo certo.
        </p>
      </div>
    );
  }

  // ---- Equipamento AVISA DEPOIS (protocolo tipo ADMS/iClock) - experimental ----
  if (tipoConexao === 'push_adms') {
    return (
      <div className="text-sm text-steel-300 space-y-2">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-200 text-xs">
          <strong>Experimental:</strong> isso tenta um protocolo comum (tipo ADMS/iClock) usado por vários
          leitores biométricos "de baixo custo" no Brasil. Não temos confirmação de que o seu equipamento
          {marca === 'evo' ? ' EVO' : ''} fala exatamente esse protocolo — vale tentar, mas se não funcionar,
          o caminho seguro é pedir o manual de integração pro suporte do fabricante/revenda.
        </div>
        <div className="bg-graphite-950 border border-graphite-800 rounded-lg p-3 font-mono text-xs text-steel-300 break-all">
          <p className="text-steel-500 mb-1">Endereço do servidor (configure no painel do próprio equipamento):</p>
          <p className="text-mint-400">{origemServidor}</p>
          <p className="text-steel-500 mt-2">Porta: a mesma da URL acima (geralmente 443 se for https, ou a porta configurada no seu backend).</p>
        </div>
        <ol className="list-decimal list-inside space-y-1 text-steel-400">
          <li>Entre no IP do equipamento com a senha de admin, e procure onde se configura o "servidor"/"nuvem"/"ADMS" (nome exato varia).</li>
          <li>Coloque o endereço acima como servidor.</li>
          <li>Em cada aluno (tela Alunos → editar), preencha "Código do dispositivo" com o mesmo código/matrícula que você cadastrar para essa pessoa no equipamento (ou cadastre o próprio CPF como código no equipamento, se ele aceitar 11 dígitos).</li>
        </ol>
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-rose-200 text-xs">
          <strong>Importante:</strong> nesse tipo de equipamento, ele decide sozinho e avisa o sistema DEPOIS
          que a pessoa já passou — diferente da Control iD, que pergunta antes. Ou seja: isso registra no
          histórico e avisa em vermelho se alguém bloqueado passou mesmo assim, mas não impede a passagem na
          hora. Pra travar de verdade em tempo real, é preciso um equipamento que "pergunte antes" (validação
          externa) — a Control iD, no seu caso, já cobre isso.
        </div>
      </div>
    );
  }

  // ---- ip_manual: sem protocolo confirmado ainda ----
  return (
    <div className="text-sm text-steel-300 space-y-2">
      <p>
        Ainda não temos um protocolo confirmado pra conectar esse equipamento automaticamente. Os campos de
        IP/usuário/senha acima ficam só como sua anotação por enquanto.
      </p>
      <ol className="list-decimal list-inside space-y-1 text-steel-400">
        <li>Entre no IP do equipamento com a senha de admin e veja se existe alguma opção de "validação externa", "validação online", "webhook" ou "servidor ADMS/nuvem".</li>
        <li>Se tiver "validação externa/online": troque o "Tipo de conexão" desta catraca pra essa opção e use a URL que aparece.</li>
        <li>Se tiver "servidor ADMS/nuvem": troque pra "Avisa depois (tipo ADMS)" e siga aquelas instruções.</li>
        <li>Se não achar nenhuma das duas: me manda o manual/modelo exato, ou peça pro suporte do fabricante o "manual de integração" — assim que eu (ou você) souber o protocolo, eu implemento certinho.</li>
      </ol>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Modal de cadastro/edição de catraca
// ----------------------------------------------------------------------------

function ModalCatraca({ catraca, onFechar, onSalvo }) {
  const [form, setForm] = useState(
    catraca || {
      nome: '',
      marca: 'control_id',
      modelo: '',
      local: '',
      sentido_padrao: 'ambos',
      observacoes: '',
      tipo_conexao: 'validacao_externa',
      ip: '',
      porta: '',
      usuario_admin: '',
      senha_admin: '',
    }
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function mudarMarca(novaMarca) {
    // Só sugere o tipo de conexão quando é catraca NOVA (edição não pisa na escolha que já foi feita).
    const sugestao = !catraca?.id
      ? MARCAS_PROVAVELMENTE_IP_LOCAL.includes(novaMarca)
        ? 'push_adms'
        : 'validacao_externa'
      : form.tipo_conexao;
    setForm({ ...form, marca: novaMarca, tipo_conexao: sugestao });
  }

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-graphite-900 border border-graphite-800 rounded-xl p-6 w-full max-w-md my-8">
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
              onChange={(e) => mudarMarca(e.target.value)}
            >
              {MARCAS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-steel-400 block mb-1">Tipo de conexão</label>
            <select
              className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-ember-500"
              value={form.tipo_conexao}
              onChange={(e) => setForm({ ...form, tipo_conexao: e.target.value })}
            >
              <option value="validacao_externa">Pergunta antes de liberar (validação externa)</option>
              <option value="push_adms">Avisa depois, tipo ADMS/iClock (experimental)</option>
              <option value="ip_manual">Não sei / ainda vou verificar</option>
            </select>
            <p className="text-steel-500 text-xs mt-1">Não sabe qual é? Deixe em "Não sei" e veja as instruções depois de salvar.</p>
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

          {form.tipo_conexao !== 'validacao_externa' && (
            <div className="bg-graphite-800/60 border border-graphite-700 rounded-lg p-3 space-y-3">
              <p className="text-xs text-steel-400">
                Anotação de conexão do equipamento (IP/admin) — pra você não perder essa informação. O
                sistema não usa isso pra se conectar automaticamente ainda.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-steel-400 block mb-1">IP do equipamento</label>
                  <input
                    className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white text-sm placeholder-steel-500 focus:outline-none focus:border-ember-500"
                    placeholder="192.168.0.50"
                    value={form.ip || ''}
                    onChange={(e) => setForm({ ...form, ip: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-steel-400 block mb-1">Porta</label>
                  <input
                    className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white text-sm placeholder-steel-500 focus:outline-none focus:border-ember-500"
                    placeholder="80"
                    value={form.porta || ''}
                    onChange={(e) => setForm({ ...form, porta: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-steel-400 block mb-1">Usuário admin</label>
                  <input
                    className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white text-sm placeholder-steel-500 focus:outline-none focus:border-ember-500"
                    placeholder="admin"
                    value={form.usuario_admin || ''}
                    onChange={(e) => setForm({ ...form, usuario_admin: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-steel-400 block mb-1">Senha admin</label>
                  <input
                    type="password"
                    className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white text-sm placeholder-steel-500 focus:outline-none focus:border-ember-500"
                    placeholder={catraca?.tem_senha_admin ? '(salva - deixe vazio p/ manter)' : ''}
                    value={form.senha_admin || ''}
                    onChange={(e) => setForm({ ...form, senha_admin: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

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
                        <InstrucoesMarca marca={c.marca} tipoConexao={c.tipo_conexao} url={urlParaCatraca(c)} chave={chave} />
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