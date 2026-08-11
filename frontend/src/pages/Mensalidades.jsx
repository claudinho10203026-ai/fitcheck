import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle2, X, Barcode, QrCode, ExternalLink, CreditCard, Copy, Loader2 } from 'lucide-react';
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
  pago: 'bg-mint-500/15 text-mint-400',
  em_aberto: 'bg-amber-500/15 text-amber-400',
  atrasado: 'bg-rose-500/15 text-rose-400',
  cancelado: 'bg-steel-500/15 text-steel-400',
};

const inputClasse =
  'w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm placeholder-steel-500 focus:outline-none focus:ring-2 focus:ring-ember-500';

function ModalBaixa({ mensalidade, aoFechar, aoConfirmar }) {
  const [formas, setFormas] = useState([]);
  const [formaId, setFormaId] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get('/caixa/formas-pagamento').then((res) => setFormas(res.data));
  }, []);

  if (!mensalidade) return null;

  async function confirmar() {
    setSalvando(true);
    try {
      await api.put(`/mensalidades/${mensalidade.id}/baixa`, { forma_pagamento_id: formaId || null });
      aoConfirmar();
      aoFechar();
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800">
          <h2 className="font-display font-semibold text-lg text-white">Dar baixa</h2>
          <button onClick={aoFechar} className="text-steel-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-steel-300">
            Confirmar pagamento de <b className="text-white">{formatarMoeda(mensalidade.valor)}</b> referente à
            parcela {mensalidade.numero_parcela}/{mensalidade.total_parcelas} de{' '}
            <b className="text-white">{mensalidade.alunos?.nome}</b>?
          </p>
          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Forma de pagamento</label>
            <select value={formaId} onChange={(e) => setFormaId(e.target.value)} className={inputClasse}>
              <option value="">Não informar</option>
              {formas.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-steel-500">
            Para vincular esse pagamento a uma sessão de caixa aberta, use a tela de Caixa em vez desta.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={aoFechar} className="px-4 py-2 rounded-lg text-sm font-medium text-steel-300 hover:bg-graphite-800">
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={salvando}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-mint-500 hover:brightness-110 disabled:opacity-60 text-graphite-950"
            >
              {salvando ? 'Confirmando...' : 'Confirmar baixa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalPix({ mensalidade, aoFechar, aoConfirmar }) {
  const [carregando, setCarregando] = useState(true);
  const [dadosPix, setDadosPix] = useState(null);
  const [erro, setErro] = useState('');
  const [pago, setPago] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const intervaloRef = useRef(null);

  useEffect(() => {
    if (!mensalidade) return;
    let cancelado = false;

    async function iniciar() {
      setCarregando(true);
      setErro('');
      setPago(false);
      try {
        const { data } = await api.post(`/mensalidades/${mensalidade.id}/gateway/pix`);
        if (cancelado) return;
        setDadosPix(data);
        intervaloRef.current = setInterval(async () => {
          try {
            const { data: status } = await api.get(`/mensalidades/${mensalidade.id}/gateway/status`);
            if (status.status === 'pago') {
              clearInterval(intervaloRef.current);
              setPago(true);
              aoConfirmar();
            }
          } catch (e) {
            /* silencioso: tenta de novo no próximo intervalo */
          }
        }, 3000);
      } catch (err) {
        setErro(err.response?.data?.erro || 'Erro ao gerar cobrança PIX.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    iniciar();

    return () => {
      cancelado = true;
      clearInterval(intervaloRef.current);
    };
  }, [mensalidade]);

  if (!mensalidade) return null;

  function copiar() {
    navigator.clipboard.writeText(dadosPix.gateway_link || '');
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800">
          <h2 className="font-display font-semibold text-lg text-white">Cobrança PIX</h2>
          <button onClick={aoFechar} className="text-steel-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 text-center">
          {carregando ? (
            <p className="text-steel-400 text-sm py-8">Gerando cobrança...</p>
          ) : erro ? (
            <p className="text-rose-400 text-sm">{erro}</p>
          ) : pago ? (
            <div className="py-8 flex flex-col items-center gap-2">
              <CheckCircle2 className="text-mint-400" size={40} />
              <p className="text-mint-400 font-medium">Pagamento confirmado!</p>
            </div>
          ) : (
            <>
              <p className="text-steel-300 text-sm mb-1">{mensalidade.alunos?.nome}</p>
              <p className="font-display text-2xl font-semibold text-white mb-4 tabular">
                {formatarMoeda(mensalidade.valor)}
              </p>
              {dadosPix?.qr_code_base64 && (
                <img
                  src={`data:image/png;base64,${dadosPix.qr_code_base64}`}
                  alt="QR Code PIX"
                  className="mx-auto rounded-lg mb-4 h-48 w-48"
                />
              )}
              <button
                onClick={copiar}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-steel-300 text-xs mb-4 hover:text-white"
              >
                <Copy size={13} /> {copiado ? 'Copiado!' : 'Copiar código PIX'}
              </button>
              <p className="flex items-center justify-center gap-2 text-steel-500 text-xs">
                <Loader2 size={13} className="animate-spin" /> Aguardando pagamento...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalCartao({ mensalidade, aoFechar, aoConfirmar }) {
  const [numero, setNumero] = useState('');
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState('');
  const [cvv, setCvv] = useState('');
  const [nomeTitular, setNomeTitular] = useState('');
  const [cpfTitular, setCpfTitular] = useState('');
  const [cepTitular, setCepTitular] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  if (!mensalidade) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await api.post(`/mensalidades/${mensalidade.id}/gateway/cartao`, {
        cartao: { numero, mesValidade: mes, anoValidade: ano, codigoSeguranca: cvv, nomeTitular },
        titular: { nome: nomeTitular, cpf: cpfTitular, cep: cepTitular },
      });
      setSucesso(true);
      aoConfirmar();
      setTimeout(aoFechar, 1200);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Cartão recusado ou dados inválidos.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800">
          <h2 className="font-display font-semibold text-lg text-white">Cobrar no cartão</h2>
          <button onClick={aoFechar} className="text-steel-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          <p className="text-sm text-steel-300 mb-1">
            {formatarMoeda(mensalidade.valor)} · {mensalidade.alunos?.nome}
          </p>
          <input required placeholder="Número do cartão" className={inputClasse} value={numero} onChange={(e) => setNumero(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <input required placeholder="MM" maxLength={2} className={inputClasse} value={mes} onChange={(e) => setMes(e.target.value)} />
            <input required placeholder="AAAA" maxLength={4} className={inputClasse} value={ano} onChange={(e) => setAno(e.target.value)} />
            <input required placeholder="CVV" maxLength={4} className={inputClasse} value={cvv} onChange={(e) => setCvv(e.target.value)} />
          </div>
          <input required placeholder="Nome do titular (como no cartão)" className={inputClasse} value={nomeTitular} onChange={(e) => setNomeTitular(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input required placeholder="CPF do titular" className={inputClasse} value={cpfTitular} onChange={(e) => setCpfTitular(e.target.value)} />
            <input required placeholder="CEP do titular" className={inputClasse} value={cepTitular} onChange={(e) => setCepTitular(e.target.value)} />
          </div>

          {erro && <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{erro}</div>}
          {sucesso && <div className="text-sm text-mint-400 bg-mint-500/10 border border-mint-500/20 rounded-lg px-3 py-2">Pagamento aprovado!</div>}

          <button
            type="submit"
            disabled={salvando}
            className="w-full bg-ember-500 hover:bg-ember-600 disabled:opacity-60 text-white font-medium text-sm py-2.5 rounded-lg"
          >
            {salvando ? 'Processando...' : 'Cobrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Mensalidades() {
  const { funcionario } = useAuth();
  const podeGerenciar = temPermissao(funcionario, 'mensalidades', 'gerenciar');
  const [mensalidades, setMensalidades] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [mensalidadeBaixa, setMensalidadeBaixa] = useState(null);
  const [mensalidadePix, setMensalidadePix] = useState(null);
  const [mensalidadeCartao, setMensalidadeCartao] = useState(null);
  const [gerandoGateway, setGerandoGateway] = useState(null);

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get('/mensalidades', { params: filtro ? { status: filtro } : {} });
      setMensalidades(data);
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

  async function gerarBoletoGateway(id) {
    setGerandoGateway(id);
    try {
      await api.post(`/mensalidades/${id}/gateway/boleto`);
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao gerar boleto.');
    } finally {
      setGerandoGateway(null);
    }
  }

  const abas = [
    { valor: '', label: 'Todas' },
    { valor: 'em_aberto', label: 'Em aberto' },
    { valor: 'atrasado', label: 'Atrasadas' },
    { valor: 'pago', label: 'Pagas' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Mensalidades</h1>
          <p className="text-steel-400 text-sm mt-1">Boletos e carnês de mensalidade dos alunos</p>
        </div>
        {podeGerenciar && (
          <Link
            to="/mensalidades/novo-carne"
            className="flex items-center gap-2 bg-ember-500 hover:bg-ember-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} /> Gerar carnê/boleto
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        {abas.map((aba) => (
          <button
            key={aba.valor}
            onClick={() => setFiltro(aba.valor)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtro === aba.valor ? 'bg-ember-500/15 text-ember-400' : 'text-steel-400 hover:text-white hover:bg-graphite-800'
            }`}
          >
            {aba.label}
          </button>
        ))}
      </div>

      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl overflow-hidden">
        {carregando ? (
          <p className="text-steel-400 text-sm p-6">Carregando...</p>
        ) : mensalidades.length === 0 ? (
          <p className="text-steel-500 text-sm p-6 text-center">Nenhuma mensalidade encontrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-800 text-left text-steel-400">
                <th className="font-medium px-5 py-3">Aluno</th>
                <th className="font-medium px-5 py-3">Parcela</th>
                <th className="font-medium px-5 py-3">Vencimento</th>
                <th className="font-medium px-5 py-3">Valor</th>
                <th className="font-medium px-5 py-3">Status</th>
                <th className="font-medium px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {mensalidades.map((m) => (
                <tr key={m.id} className="border-b border-graphite-800 last:border-0">
                  <td className="px-5 py-3">
                    <Link to={`/alunos/${m.alunos?.id}`} className="text-white font-medium hover:text-ember-400">{m.alunos?.nome}</Link>
                  </td>
                  <td className="px-5 py-3 text-steel-400">{m.numero_parcela}/{m.total_parcelas}</td>
                  <td className="px-5 py-3 text-steel-400">{formatarData(m.data_vencimento)}</td>
                  <td className="px-5 py-3 text-steel-300 tabular">{formatarMoeda(m.valor)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${BADGES[m.status]}`}>
                      {m.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {!podeGerenciar ? (
                      <span className="text-steel-600 text-xs">—</span>
                    ) : m.status !== 'pago' && m.status !== 'cancelado' ? (
                      <div className="flex items-center gap-3">
                        <button onClick={() => setMensalidadeBaixa(m)} className="flex items-center gap-1 text-mint-400 hover:text-mint-300 text-xs font-medium">
                          <CheckCircle2 size={13} /> Dar baixa
                        </button>
                        {m.gateway_boleto_url ? (
                          <a href={m.gateway_boleto_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-steel-400 hover:text-white text-xs font-medium">
                            <ExternalLink size={13} /> Ver boleto
                          </a>
                        ) : (
                          <button
                            onClick={() => gerarBoletoGateway(m.id)}
                            disabled={gerandoGateway === m.id}
                            className="flex items-center gap-1 text-steel-400 hover:text-white text-xs font-medium disabled:opacity-60"
                          >
                            <Barcode size={13} /> Gerar boleto
                          </button>
                        )}
                        <button onClick={() => setMensalidadePix(m)} className="flex items-center gap-1 text-steel-400 hover:text-white text-xs font-medium">
                          <QrCode size={13} /> PIX
                        </button>
                        <button onClick={() => setMensalidadeCartao(m)} className="flex items-center gap-1 text-steel-400 hover:text-white text-xs font-medium">
                          <CreditCard size={13} /> Cartão
                        </button>
                      </div>
                    ) : (
                      <span className="text-steel-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ModalBaixa mensalidade={mensalidadeBaixa} aoFechar={() => setMensalidadeBaixa(null)} aoConfirmar={carregar} />
      <ModalPix mensalidade={mensalidadePix} aoFechar={() => setMensalidadePix(null)} aoConfirmar={carregar} />
      <ModalCartao mensalidade={mensalidadeCartao} aoFechar={() => setMensalidadeCartao(null)} aoConfirmar={carregar} />
    </div>
  );
}
