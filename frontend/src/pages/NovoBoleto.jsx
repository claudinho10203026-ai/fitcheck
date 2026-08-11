import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, X, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function NovoBoleto() {
  const navigate = useNavigate();

  const [busca, setBusca] = useState('');
  const [opcoesAluno, setOpcoesAluno] = useState([]);
  const [aluno, setAluno] = useState(null);
  const [matriculas, setMatriculas] = useState([]);
  const [matriculaId, setMatriculaId] = useState('');

  const [valorParcela, setValorParcela] = useState('');
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [diaFixo, setDiaFixo] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (!busca || aluno) return setOpcoesAluno([]);
    const timeout = setTimeout(() => {
      api.get('/alunos', { params: { busca } }).then((res) => setOpcoesAluno(res.data));
    }, 300);
    return () => clearTimeout(timeout);
  }, [busca, aluno]);

  useEffect(() => {
    if (!aluno) {
      setMatriculas([]);
      return;
    }
    api.get(`/alunos/${aluno.id}`).then((res) => {
      const ativas = res.data.matriculas.filter((m) => m.status === 'ativa');
      setMatriculas(ativas);
      if (ativas.length === 1) {
        setMatriculaId(ativas[0].id);
        setValorParcela(ativas[0].planos?.valor || '');
      }
    });
  }, [aluno]);

  const parcelasPreview = useMemo(() => {
    if (!valorParcela || !numeroParcelas || !primeiroVencimento) return [];
    const base = new Date(`${primeiroVencimento}T00:00:00`);
    return Array.from({ length: Number(numeroParcelas) }, (_, i) => {
      const venc = new Date(base);
      venc.setMonth(venc.getMonth() + i);
      if (diaFixo) venc.setDate(Number(diaFixo));
      return { numero: i + 1, vencimento: venc.toLocaleDateString('pt-BR') };
    });
  }, [valorParcela, numeroParcelas, primeiroVencimento, diaFixo]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    if (!aluno || !matriculaId || !valorParcela) {
      setErro('Preencha aluno, matrícula e valor da parcela.');
      return;
    }
    setSalvando(true);
    try {
      await api.post('/mensalidades/gerar-carne', {
        aluno_id: aluno.id,
        matricula_id: matriculaId,
        valor_parcela: Number(valorParcela),
        numero_parcelas: Number(numeroParcelas),
        primeiro_vencimento: primeiroVencimento,
        dia_vencimento_fixo: diaFixo ? Number(diaFixo) : undefined,
      });
      setSucesso(true);
      setTimeout(() => navigate('/mensalidades'), 1200);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao gerar o carnê.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate('/mensalidades')}
        className="flex items-center gap-1.5 text-steel-400 hover:text-white text-sm mb-6"
      >
        <ArrowLeft size={16} /> Voltar para mensalidades
      </button>

      <h1 className="font-display text-2xl font-semibold text-white mb-1">Criação de carnê/boleto</h1>
      <p className="text-steel-400 text-sm mb-8">
        Gere uma ou várias parcelas de mensalidade (carnê) para um aluno matriculado.
      </p>

      <form onSubmit={handleSubmit} className="bg-graphite-900 border border-graphite-800 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-xs font-medium text-steel-400 mb-1.5">Aluno *</label>
          {aluno ? (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-graphite-800 border border-graphite-700 text-sm">
              <span className="text-white">{aluno.nome}</span>
              <button
                type="button"
                onClick={() => {
                  setAluno(null);
                  setMatriculaId('');
                  setValorParcela('');
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
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
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
                        setBusca('');
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

        {aluno && (
          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Matrícula ativa *</label>
            {matriculas.length === 0 ? (
              <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                Este aluno não possui matrícula ativa. Libere uma matrícula antes de gerar o carnê.
              </p>
            ) : (
              <select
                required
                value={matriculaId}
                onChange={(e) => {
                  setMatriculaId(e.target.value);
                  const m = matriculas.find((x) => x.id === e.target.value);
                  if (m) setValorParcela(m.planos?.valor || '');
                }}
                className="w-full px-3 py-2.5 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
              >
                {matriculas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.planos?.nome} - {formatarMoeda(m.planos?.valor)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Valor da parcela (R$) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={valorParcela}
              onChange={(e) => setValorParcela(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Número de parcelas *</label>
            <input
              type="number"
              min={1}
              max={24}
              required
              value={numeroParcelas}
              onChange={(e) => setNumeroParcelas(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">1º vencimento *</label>
            <input
              type="date"
              required
              value={primeiroVencimento}
              onChange={(e) => setPrimeiroVencimento(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Dia fixo de vencimento</label>
            <input
              type="number"
              min={1}
              max={28}
              placeholder="opcional, ex: 10"
              value={diaFixo}
              onChange={(e) => setDiaFixo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm"
            />
          </div>
        </div>

        {parcelasPreview.length > 0 && (
          <div>
            <p className="text-xs font-medium text-steel-400 mb-2">Prévia das parcelas</p>
            <div className="flex flex-wrap gap-2">
              {parcelasPreview.map((p) => (
                <span
                  key={p.numero}
                  className="text-xs bg-graphite-800 border border-graphite-700 text-steel-300 px-2.5 py-1 rounded-full tabular"
                >
                  {p.numero}/{numeroParcelas} · {p.vencimento}
                </span>
              ))}
            </div>
          </div>
        )}

        {erro && (
          <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="flex items-center gap-2 text-sm text-mint-400 bg-mint-500/10 border border-mint-500/20 rounded-lg px-3 py-2">
            <CheckCircle2 size={16} /> Carnê gerado com sucesso!
          </div>
        )}

        <button
          type="submit"
          disabled={salvando || matriculas.length === 0}
          className="w-full bg-ember-500 hover:bg-ember-600 disabled:opacity-60 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
        >
          {salvando ? 'Gerando...' : 'Gerar carnê'}
        </button>
      </form>
    </div>
  );
}
