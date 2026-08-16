import { useEffect, useRef, useState } from 'react';
import {
  Wallet,
  Plus,
  Minus,
  X,
  Lock,
  Unlock,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  QrCode,
  Copy,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { temPermissao } from '../lib/permissoes';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarHora(data) {
  return new Date(data).toLocaleString('pt-BR');
}

const CATEGORIAS = [
  { valor: 'mensalidade', label: 'Mensalidade de aluno' },
  { valor: 'produto', label: 'Produto/serviço' },
  { valor: 'suprimento', label: 'Suprimento de caixa' },
  { valor: 'sangria', label: 'Sangria' },
  { valor: 'outro', label: 'Outro' },
];

function ModalAbrirCaixa({ aberto, aoFechar, aoConfirmar }) {
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!aberto) return null;

  async function confirmar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post('/caixa/abrir', { valor_abertura: Number(valor || 0) });
      aoConfirmar();
      aoFechar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao abrir caixa.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800">
          <h2 className="font-display font-semibold text-lg text-white">Abrir caixa</h2>
          <button onClick={aoFechar} className="text-steel-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={confirmar} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Valor inicial (troco)</label>
            <input
              type="number"
              step="0.01"
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2.5 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="w-full flex items-center justify-center gap-2 bg-mint-500 hover:brightness-110 disabled:opacity-60 text-graphite-950 font-medium text-sm py-2.5 rounded-lg"
          >
            <Unlock size={15} /> {salvando ? 'Abrindo...' : 'Abrir caixa'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalFecharCaixa({ sessao, aoFechar, aoConfirmar }) {
  const [valorInformado, setValorInformado] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!sessao) return null;

  async function confirmar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post(`/caixa/${sessao.id}/fechar`, {
        valor_fechamento_informado: Number(valorInformado || 0),
        observacoes,
      });
      aoConfirmar();
      aoFechar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao fechar caixa.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800">
          <h2 className="font-display font-semibold text-lg text-white">Fechar caixa</h2>
          <button onClick={aoFechar} className="text-steel-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={confirmar} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">
              Valor contado fisicamente no caixa
            </label>
            <input
              type="number"
              step="0.01"
              autoFocus
              required
              value={valorInformado}
              onChange={(e) => setValorInformado(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="w-full flex items-center justify-center gap-2 bg-rose-500 hover:brightness-110 disabled:opacity-60 text-white font-medium text-sm py-2.5 rounded-lg"
          >
            <Lock size={15} /> {salvando ? 'Fechando...' : 'Fechar caixa'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalMovimentacao({ aberto, sessaoId, aoFechar, aoConfirmar, preSelecionado = null }) {
  const [tipo, setTipo] = useState('entrada');
  const [categoria, setCategoria] = useState('mensalidade');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [formas, setFormas] = useState([]);
  const [formaId, setFormaId] = useState('');

  const [buscaAluno, setBuscaAluno] = useState('');
  const [opcoesAluno, setOpcoesAluno] = useState([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState(null);
  const [mensalidadesAluno, setMensalidadesAluno] = useState([]);
  const [mensalidadeId, setMensalidadeId] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [mostrandoPix, setMostrandoPix] = useState(false);
  const [carregandoPix, setCarregandoPix] = useState(false);
  const [dadosPix, setDadosPix] = useState(null);
  const [pagoPix, setPagoPix] = useState(false);
  const [copiadoPix, setCopiadoPix] = useState(false);
  const intervaloPixRef = useRef(null);

  useEffect(() => {
    if (aberto) {
      api.get('/caixa/formas-pagamento').then((res) => setFormas(res.data));
      setTipo('entrada');
      setCategoria('mensalidade');
      setFormaId('');
      setErro('');
      setMostrandoPix(false);
      setDadosPix(null);
      setPagoPix(false);

      if (preSelecionado) {
        // Veio do painel de "mensalidades atrasadas" - já pula direto pra
        // cobrança, sem precisar buscar o aluno de novo.
        setAlunoSelecionado(preSelecionado.aluno);
        setMensalidadeId(preSelecionado.mensalidade.id);
        setValor(preSelecionado.mensalidade.valor);
        setDescricao(
          `Mensalidade ${preSelecionado.mensalidade.numero_parcela}/${preSelecionado.mensalidade.total_parcelas} - ${preSelecionado.aluno.nome}`
        );
      } else {
        setDescricao('');
        setValor('');
        setAlunoSelecionado(null);
        setMensalidadeId('');
      }
    }
    return () => clearInterval(intervaloPixRef.current);
  }, [aberto, preSelecionado]);

  useEffect(() => {
    if (!buscaAluno || alunoSelecionado) return setOpcoesAluno([]);
    const t = setTimeout(() => {
      api.get('/alunos', { params: { busca: buscaAluno } }).then((res) => setOpcoesAluno(res.data));
    }, 300);
    return () => clearTimeout(t);
  }, [buscaAluno, alunoSelecionado]);

  useEffect(() => {
    if (!alunoSelecionado) return setMensalidadesAluno([]);
    api
      .get('/mensalidades', { params: { aluno_id: alunoSelecionado.id } })
      .then((res) => setMensalidadesAluno(res.data.filter((m) => m.status !== 'pago' && m.status !== 'cancelado')));
  }, [alunoSelecionado]);

  if (!aberto) return null;

  function selecionarMensalidade(id) {
    setMensalidadeId(id);
    const m = mensalidadesAluno.find((x) => x.id === id);
    if (m) {
      setValor(m.valor);
      setDescricao(`Mensalidade ${m.numero_parcela}/${m.total_parcelas} - ${alunoSelecionado.nome}`);
    }
  }

  async function registrarMovimentacao(dadosExtra = {}) {
    await api.post(`/caixa/${sessaoId}/movimentacao`, {
      tipo,
      categoria,
      descricao,
      valor: Number(valor),
      forma_pagamento_id: formaId || null,
      mensalidade_id: categoria === 'mensalidade' ? mensalidadeId || null : null,
      ...dadosExtra,
    });
    aoConfirmar();
  }

  async function cobrarPix() {
    setMostrandoPix(true);
    setCarregandoPix(true);
    setPagoPix(false);
    setErro('');
    try {
      const { data } = await api.post(`/mensalidades/${mensalidadeId}/gateway/pix`);
      setDadosPix(data);
      intervaloPixRef.current = setInterval(async () => {
        try {
          const { data: status } = await api.get(`/mensalidades/${mensalidadeId}/gateway/status`);
          if (status.status === 'pago') {
            clearInterval(intervaloPixRef.current);
            setPagoPix(true);
            // já foi dado baixa pelo gateway - só registra a entrada no caixa do dia
            await registrarMovimentacao({ forma_pagamento_id: null });
            setTimeout(aoFechar, 1500);
          }
        } catch (e) {
          /* tenta de novo no próximo intervalo */
        }
      }, 3000);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao gerar cobrança PIX.');
      setMostrandoPix(false);
    } finally {
      setCarregandoPix(false);
    }
  }

  function copiarCodigoPix() {
    navigator.clipboard.writeText(dadosPix?.gateway_link || '');
    setCopiadoPix(true);
    setTimeout(() => setCopiadoPix(false), 1500);
  }

  async function confirmar(e) {
    e.preventDefault();
    if (!valor) {
      setErro('Informe o valor.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await registrarMovimentacao();
      aoFechar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao registrar movimentação.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl w-full max-w-md mt-8 mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800">
          <h2 className="font-display font-semibold text-lg text-white">
            {mostrandoPix ? 'Cobrança PIX' : 'Nova movimentação'}
          </h2>
          <button onClick={aoFechar} className="text-steel-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {mostrandoPix ? (
          <div className="p-6 text-center">
            {carregandoPix ? (
              <p className="text-steel-400 text-sm py-8">Gerando cobrança...</p>
            ) : pagoPix ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <CheckCircle2 className="text-mint-400" size={40} />
                <p className="text-mint-400 font-medium">Pagamento confirmado e lançado no caixa!</p>
              </div>
            ) : (
              <>
                <p className="font-display text-2xl font-semibold text-white mb-4 tabular">{formatarMoeda(valor)}</p>
                {dadosPix?.qr_code_base64 && (
                  <img src={`data:image/png;base64,${dadosPix.qr_code_base64}`} alt="QR Code PIX" className="mx-auto rounded-lg mb-4 h-48 w-48" />
                )}
                <button
                  onClick={copiarCodigoPix}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-steel-300 text-xs mb-4 hover:text-white"
                >
                  <Copy size={13} /> {copiadoPix ? 'Copiado!' : 'Copiar código PIX'}
                </button>
                <p className="flex items-center justify-center gap-2 text-steel-500 text-xs mb-4">
                  <Loader2 size={13} className="animate-spin" /> Aguardando o aluno pagar...
                </p>
                <button
                  onClick={() => setMostrandoPix(false)}
                  className="text-steel-400 hover:text-white text-xs"
                >
                  Voltar e registrar de outra forma
                </button>
              </>
            )}
            {erro && (
              <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mt-2">{erro}</div>
            )}
          </div>
        ) : (
        <form onSubmit={confirmar} className="p-6 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipo('entrada')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border ${
                tipo === 'entrada'
                  ? 'bg-mint-500/15 border-mint-500/40 text-mint-400'
                  : 'border-graphite-700 text-steel-400'
              }`}
            >
              <ArrowUpCircle size={15} /> Entrada
            </button>
            <button
              type="button"
              onClick={() => setTipo('saida')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border ${
                tipo === 'saida'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                  : 'border-graphite-700 text-steel-400'
              }`}
            >
              <ArrowDownCircle size={15} /> Saída
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Categoria</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {categoria === 'mensalidade' && (
            <div className="space-y-3 bg-graphite-800/60 border border-graphite-700 rounded-lg p-3">
              <label className="block text-xs font-medium text-steel-400">Aluno</label>
              {alunoSelecionado ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-sm">
                  <span className="text-white">{alunoSelecionado.nome}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAlunoSelecionado(null);
                      setMensalidadeId('');
                    }}
                    className="text-steel-500 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" size={14} />
                  <input
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
                    placeholder="Buscar aluno..."
                    value={buscaAluno}
                    onChange={(e) => setBuscaAluno(e.target.value)}
                  />
                  {opcoesAluno.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-graphite-800 border border-graphite-700 rounded-lg max-h-32 overflow-y-auto">
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
                          {a.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {alunoSelecionado && (
                <div>
                  <label className="block text-xs font-medium text-steel-400 mb-1.5">Mensalidade a pagar</label>
                  {mensalidadesAluno.length === 0 ? (
                    <p className="text-xs text-steel-500">Nenhuma mensalidade em aberto para este aluno.</p>
                  ) : (
                    <select
                      value={mensalidadeId}
                      onChange={(e) => selecionarMensalidade(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
                    >
                      <option value="">Selecione...</option>
                      {mensalidadesAluno.map((m) => (
                        <option key={m.id} value={m.id}>
                          Parcela {m.numero_parcela}/{m.total_parcelas} - {formatarMoeda(m.valor)} (venc.{' '}
                          {new Date(`${m.data_vencimento}T00:00:00`).toLocaleDateString('pt-BR')})
                        </option>
                      ))}
                    </select>
                  )}
                  {mensalidadeId && (
                    <button
                      type="button"
                      onClick={cobrarPix}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-ember-500/40 text-ember-400 hover:bg-ember-500/10 text-xs font-medium"
                    >
                      <QrCode size={13} /> Cobrar via PIX (gera QR code de verdade)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-steel-400 mb-1.5">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-400 mb-1.5">Forma de pagamento</label>
              <select
                value={formaId}
                onChange={(e) => setFormaId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
              >
                <option value="">Selecione</option>
                {formas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {erro && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="w-full bg-ember-500 hover:bg-ember-600 disabled:opacity-60 text-white font-medium text-sm py-2.5 rounded-lg"
          >
            {salvando ? 'Registrando...' : 'Registrar movimentação'}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}

function diasEmAtraso(dataVencimento) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(`${dataVencimento}T00:00:00`);
  return Math.max(0, Math.round((hoje - venc) / 86400000));
}

// Painel lateral do Caixa: mostra as mensalidades atrasadas (a mesma lista
// que aparece em Mensalidades), filtrável por nome, com botão pra já abrir a
// cobrança direto - sem precisar sair do Caixa e ir pra outra tela.
function PainelMensalidadesAtrasadas({ sessaoAberta, aoCobrar }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  async function carregar() {
    try {
      const { data } = await api.get('/mensalidades', { params: { status: 'atrasado' } });
      setLista(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 20000);
    return () => clearInterval(intervalo);
  }, []);

  const filtrada = busca
    ? lista.filter((m) => m.alunos?.nome?.toLowerCase().includes(busca.toLowerCase()))
    : lista;

  return (
    <div className="bg-graphite-900 border border-graphite-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={17} className="text-rose-400" />
        <h2 className="font-display text-base font-semibold text-white">Mensalidades atrasadas</h2>
      </div>
      <p className="text-steel-500 text-xs mb-3">{lista.length} no total</p>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" size={14} />
        <input
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm placeholder-steel-500"
          placeholder="Filtrar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {carregando ? (
        <p className="text-steel-500 text-sm">Carregando...</p>
      ) : filtrada.length === 0 ? (
        <p className="text-steel-500 text-sm">{busca ? 'Nenhum resultado.' : 'Nenhuma mensalidade atrasada 🎉'}</p>
      ) : (
        <div className="space-y-2 max-h-[28rem] overflow-y-auto -mr-1 pr-1">
          {filtrada.map((m) => (
            <div key={m.id} className="bg-graphite-950 border border-graphite-800 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{m.alunos?.nome}</p>
                  <p className="text-steel-500 text-xs">
                    {formatarMoeda(m.valor)} · {diasEmAtraso(m.data_vencimento)}d de atraso
                  </p>
                </div>
              </div>
              <button
                onClick={() => aoCobrar({ aluno: m.alunos, mensalidade: m })}
                disabled={!sessaoAberta}
                title={!sessaoAberta ? 'Abra o caixa pra poder receber' : ''}
                className="mt-2 w-full flex items-center justify-center gap-1.5 bg-mint-500/10 hover:bg-mint-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-mint-400 border border-mint-500/20 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Receipt size={13} /> Receber
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Caixa() {
  const { funcionario } = useAuth();
  const podeGerenciar = temPermissao(funcionario, 'caixa', 'gerenciar');
  const [sessao, setSessao] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalFechar, setModalFechar] = useState(false);
  const [modalMovimentacao, setModalMovimentacao] = useState(false);
  const [cobrancaPreSelecionada, setCobrancaPreSelecionada] = useState(null);

  function abrirCobranca(dados) {
    setCobrancaPreSelecionada(dados);
    setModalMovimentacao(true);
  }

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get('/caixa/atual');
      setSessao(data.sessao);
      setMovimentacoes(data.movimentacoes);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const totalEntradas = movimentacoes.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const totalSaidas = movimentacoes.filter((m) => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  const saldoAtual = (sessao ? Number(sessao.valor_abertura) : 0) + totalEntradas - totalSaidas;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Caixa</h1>
          <p className="text-steel-400 text-sm mt-1">Controle de caixa completo (não fiscal)</p>
        </div>
        {!podeGerenciar ? null : sessao ? (
          <button
            onClick={() => setModalFechar(true)}
            className="flex items-center gap-2 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-sm font-medium px-4 py-2.5 rounded-lg"
          >
            <Lock size={15} /> Fechar caixa
          </button>
        ) : (
          <button
            onClick={() => setModalAbrir(true)}
            className="flex items-center gap-2 bg-mint-500 hover:brightness-110 text-graphite-950 text-sm font-medium px-4 py-2.5 rounded-lg"
          >
            <Unlock size={15} /> Abrir caixa
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {carregando ? (
            <p className="text-steel-400 text-sm">Carregando...</p>
          ) : !sessao ? (
            <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-10 text-center">
              <Wallet className="mx-auto text-steel-600 mb-3" size={32} />
              <p className="text-steel-400 text-sm">Nenhuma sessão de caixa aberta no momento.</p>
              <p className="text-steel-500 text-xs mt-1">Abra o caixa para começar a registrar pagamentos do dia.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
                  <p className="text-steel-400 text-xs font-medium mb-1">Abertura</p>
                  <p className="font-display text-xl font-semibold text-white tabular">
                    {formatarMoeda(sessao.valor_abertura)}
                  </p>
                </div>
                <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
                  <p className="text-steel-400 text-xs font-medium mb-1">Entradas</p>
                  <p className="font-display text-xl font-semibold text-mint-400 tabular">
                    +{formatarMoeda(totalEntradas)}
                  </p>
                </div>
                <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5">
                  <p className="text-steel-400 text-xs font-medium mb-1">Saídas</p>
                  <p className="font-display text-xl font-semibold text-rose-400 tabular">
                    -{formatarMoeda(totalSaidas)}
                  </p>
                </div>
                <div className="bg-graphite-900 border border-ember-500/30 rounded-2xl p-5">
                  <p className="text-ember-400 text-xs font-medium mb-1">Saldo atual</p>
                  <p className="font-display text-xl font-semibold text-white tabular">{formatarMoeda(saldoAtual)}</p>
                </div>
              </div>

              <div className="bg-graphite-900 border border-graphite-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-graphite-800">
                  <h3 className="font-display font-semibold text-white">Movimentações</h3>
                  {podeGerenciar && (
                    <button
                      onClick={() => setModalMovimentacao(true)}
                      className="flex items-center gap-1.5 bg-ember-500 hover:bg-ember-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
                    >
                      <Plus size={14} /> Nova movimentação
                    </button>
                  )}
                </div>

                {movimentacoes.length === 0 ? (
                  <p className="text-steel-500 text-sm p-6 text-center">Nenhuma movimentação registrada ainda.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-steel-400 border-b border-graphite-800">
                          <th className="font-medium px-5 py-3">Horário</th>
                          <th className="font-medium px-5 py-3">Descrição</th>
                          <th className="font-medium px-5 py-3">Categoria</th>
                          <th className="font-medium px-5 py-3">Forma</th>
                          <th className="font-medium px-5 py-3 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimentacoes.map((m) => (
                          <tr key={m.id} className="border-b border-graphite-800 last:border-0">
                            <td className="px-5 py-3 text-steel-500 text-xs">{formatarHora(m.created_at)}</td>
                            <td className="px-5 py-3 text-white">{m.descricao || '-'}</td>
                            <td className="px-5 py-3 text-steel-400 capitalize">{m.categoria}</td>
                            <td className="px-5 py-3 text-steel-400">{m.formas_pagamento?.nome || '-'}</td>
                            <td
                              className={`px-5 py-3 text-right font-medium tabular ${
                                m.tipo === 'entrada' ? 'text-mint-400' : 'text-rose-400'
                              }`}
                            >
                              {m.tipo === 'entrada' ? '+' : '-'}
                              {formatarMoeda(m.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-1">
          <PainelMensalidadesAtrasadas sessaoAberta={Boolean(sessao)} aoCobrar={abrirCobranca} />
        </div>
      </div>

      <ModalAbrirCaixa aberto={modalAbrir} aoFechar={() => setModalAbrir(false)} aoConfirmar={carregar} />
      <ModalFecharCaixa sessao={modalFechar ? sessao : null} aoFechar={() => setModalFechar(false)} aoConfirmar={carregar} />
      <ModalMovimentacao
        aberto={modalMovimentacao}
        sessaoId={sessao?.id}
        preSelecionado={cobrancaPreSelecionada}
        aoFechar={() => {
          setModalMovimentacao(false);
          setCobrancaPreSelecionada(null);
        }}
        aoConfirmar={() => {
          carregar();
          setCobrancaPreSelecionada(null);
        }}
      />
    </div>
  );
}
