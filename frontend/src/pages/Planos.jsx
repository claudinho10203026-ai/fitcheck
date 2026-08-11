import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Tag } from 'lucide-react';
import api from '../lib/api';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const PLANO_VAZIO = { nome: '', valor: '', duracao_meses: 1, descricao: '', ativo: true };

function ModalPlano({ plano, aberto, aoFechar, aoSalvar }) {
  const editando = Boolean(plano);
  const [form, setForm] = useState(PLANO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setForm(plano ? { ...plano } : PLANO_VAZIO);
      setErro('');
    }
  }, [aberto, plano]);

  if (!aberto) return null;

  async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      const payload = { ...form, valor: Number(form.valor), duracao_meses: Number(form.duracao_meses) };
      if (editando) {
        await api.put(`/planos/${plano.id}`, payload);
      } else {
        await api.post('/planos', payload);
      }
      aoSalvar();
      aoFechar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar plano.');
    } finally {
      setSalvando(false);
    }
  }

  const inputClasse =
    'w-full px-3 py-2 rounded-lg bg-graphite-800 border border-graphite-700 text-white text-sm placeholder-steel-500 focus:outline-none focus:ring-2 focus:ring-ember-500';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800">
          <h2 className="font-display font-semibold text-lg text-white">
            {editando ? 'Editar plano' : 'Novo plano'}
          </h2>
          <button onClick={aoFechar} className="text-steel-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Nome do plano *</label>
            <input
              required
              className={inputClasse}
              placeholder="ex: Mensal, Trimestral, Anual"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-steel-400 mb-1.5">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                className={inputClasse}
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-400 mb-1.5">Duração (meses) *</label>
              <input
                type="number"
                min={1}
                required
                className={inputClasse}
                value={form.duracao_meses}
                onChange={(e) => setForm({ ...form, duracao_meses: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-400 mb-1.5">Descrição</label>
            <textarea
              rows={2}
              className={inputClasse}
              value={form.descricao || ''}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-steel-300">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="rounded border-graphite-700 bg-graphite-800 text-ember-500 focus:ring-ember-500"
            />
            Plano ativo (aparece nas telas de matrícula/carnê)
          </label>

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
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar plano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Planos() {
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [planoEditando, setPlanoEditando] = useState(null);

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get('/planos');
      setPlanos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Planos</h1>
          <p className="text-steel-400 text-sm mt-1">Tipos de mensalidade, preços e duração</p>
        </div>
        <button
          onClick={() => {
            setPlanoEditando(null);
            setModalAberto(true);
          }}
          className="flex items-center gap-2 bg-ember-500 hover:bg-ember-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} /> Novo plano
        </button>
      </div>

      {carregando ? (
        <p className="text-steel-400 text-sm">Carregando...</p>
      ) : planos.length === 0 ? (
        <div className="bg-graphite-900 border border-graphite-800 rounded-2xl p-10 text-center">
          <Tag className="mx-auto text-steel-600 mb-3" size={32} />
          <p className="text-steel-400 text-sm">Nenhum plano cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {planos.map((p) => (
            <div key={p.id} className="bg-graphite-900 border border-graphite-800 rounded-2xl p-5 relative">
              {!p.ativo && (
                <span className="absolute top-4 right-4 text-xs font-medium px-2 py-1 rounded-full bg-steel-500/15 text-steel-400">
                  Inativo
                </span>
              )}
              <p className="text-steel-400 text-xs font-medium mb-1">{p.duracao_meses}x mês(es)</p>
              <h3 className="font-display text-lg font-semibold text-white mb-2">{p.nome}</h3>
              <p className="font-display text-2xl font-semibold text-ember-400 tabular mb-3">
                {formatarMoeda(p.valor)}
              </p>
              {p.descricao && <p className="text-steel-500 text-sm mb-4">{p.descricao}</p>}
              <button
                onClick={() => {
                  setPlanoEditando(p);
                  setModalAberto(true);
                }}
                className="flex items-center gap-1.5 text-steel-400 hover:text-white text-xs font-medium"
              >
                <Pencil size={13} /> Editar
              </button>
            </div>
          ))}
        </div>
      )}

      <ModalPlano
        plano={planoEditando}
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoSalvar={carregar}
      />
    </div>
  );
}
