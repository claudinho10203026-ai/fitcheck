import { useEffect, useState } from 'react';
import { CreditCard, Save, Eye, EyeOff, CheckCircle2, ExternalLink } from 'lucide-react';
import api from '../lib/api';

function CartaoProvedor({ titulo, corBadge, configurado, proprioDaAcademia, chaveMascarada, children }) {
  return (
    <div className="bg-graphite-900 border border-graphite-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg font-semibold text-white">{titulo}</h2>
        {configurado ? (
          <span className={`inline-flex items-center gap-1 ${corBadge} px-2 py-0.5 rounded-full text-xs font-medium`}>
            <CheckCircle2 size={12} /> Configurado
          </span>
        ) : (
          <span className="text-steel-500 text-xs">Não configurado</span>
        )}
      </div>
      {configurado && (
        <p className="text-steel-500 text-xs mb-4">
          {proprioDaAcademia ? `Chave própria desta academia: ${chaveMascarada}` : 'Usando a chave padrão do sistema (.env) — ainda não é uma chave própria desta academia.'}
        </p>
      )}
      {!configurado && <div className="mb-4" />}
      {children}
    </div>
  );
}

export default function ConfiguracaoPagamento() {
  const [carregando, setCarregando] = useState(true);
  const [config, setConfig] = useState(null);
  const [asaasKey, setAsaasKey] = useState('');
  const [asaasAmbiente, setAsaasAmbiente] = useState('sandbox');
  const [mpToken, setMpToken] = useState('');
  const [mostrarAsaas, setMostrarAsaas] = useState(false);
  const [mostrarMp, setMostrarMp] = useState(false);
  const [provedorPreferido, setProvedorPreferido] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  async function carregar() {
    try {
      const { data } = await api.get('/configuracao-pagamento');
      setConfig(data);
      setAsaasAmbiente(data.asaas.ambiente);
      setProvedorPreferido(data.provedor_preferido || '');
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      const body = { provedor_preferido: provedorPreferido || null, asaas_ambiente: asaasAmbiente };
      if (asaasKey.trim()) body.asaas_api_key = asaasKey.trim();
      if (mpToken.trim()) body.mercadopago_access_token = mpToken.trim();

      await api.put('/configuracao-pagamento', body);
      setMensagem({ ok: true, texto: 'Configuração salva.' });
      setAsaasKey('');
      setMpToken('');
      carregar();
    } catch (err) {
      setMensagem({ ok: false, texto: err.response?.data?.erro || 'Erro ao salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  async function remover(provedor) {
    if (!window.confirm(`Remover a chave do ${provedor === 'asaas' ? 'Asaas' : 'Mercado Pago'} desta academia?`)) return;
    try {
      await api.put('/configuracao-pagamento', provedor === 'asaas' ? { remover_asaas: true } : { remover_mercadopago: true });
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao remover.');
    }
  }

  if (carregando) {
    return <p className="text-steel-500 text-sm">Carregando...</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-white">Gateway de Pagamento</h1>
        <p className="text-steel-400 text-sm mt-1">
          Configure a conta desta academia pra emitir boleto/PIX e dar baixa automática quando o aluno pagar.
        </p>
        {config?.provedor_ativo && (
          <p className="text-mint-400 text-xs mt-2">
            Em uso agora: {config.provedor_ativo === 'asaas' ? 'Asaas' : 'Mercado Pago'}
          </p>
        )}
      </div>

      <form onSubmit={salvar} className="space-y-5 max-w-2xl">
        <CartaoProvedor
          titulo="Asaas"
          corBadge="bg-mint-500/10 text-mint-400 border border-mint-500/20"
          configurado={config?.asaas.configurado}
          proprioDaAcademia={config?.asaas.proprio_da_academia}
          chaveMascarada={config?.asaas.chave_mascarada}
        >
          <p className="text-steel-500 text-xs mb-3">
            Pegue sua chave em{' '}
            <a
              href="https://www.asaas.com/customerIntegrations/api"
              target="_blank"
              rel="noreferrer"
              className="text-ember-400 hover:underline inline-flex items-center gap-1"
            >
              asaas.com → Integrações → API <ExternalLink size={11} />
            </a>
            . Depois de salvar, configure o webhook no painel do Asaas apontando pra URL de webhook do seu sistema (peça pro seu desenvolvedor/instalador a URL exata do backend).
          </p>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type={mostrarAsaas ? 'text' : 'password'}
                className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white placeholder-steel-500 focus:outline-none focus:border-ember-500"
                placeholder={config?.asaas.proprio_da_academia ? 'Nova chave (deixe vazio pra manter a atual)' : 'Cole sua chave de API do Asaas'}
                value={asaasKey}
                onChange={(e) => setAsaasKey(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setMostrarAsaas(!mostrarAsaas)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-steel-500 hover:text-steel-300"
              >
                {mostrarAsaas ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <select
              className="bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-ember-500"
              value={asaasAmbiente}
              onChange={(e) => setAsaasAmbiente(e.target.value)}
            >
              <option value="sandbox">Sandbox (teste)</option>
              <option value="production">Produção</option>
            </select>
          </div>
          {config?.asaas.proprio_da_academia && (
            <button type="button" onClick={() => remover('asaas')} className="text-rose-400 hover:underline text-xs">
              Remover chave do Asaas
            </button>
          )}
        </CartaoProvedor>

        <CartaoProvedor
          titulo="Mercado Pago"
          corBadge="bg-mint-500/10 text-mint-400 border border-mint-500/20"
          configurado={config?.mercadopago.configurado}
          proprioDaAcademia={config?.mercadopago.proprio_da_academia}
          chaveMascarada={config?.mercadopago.token_mascarado}
        >
          <p className="text-steel-500 text-xs mb-3">
            Pegue seu access token em{' '}
            <a
              href="https://www.mercadopago.com.br/developers/panel/app"
              target="_blank"
              rel="noreferrer"
              className="text-ember-400 hover:underline inline-flex items-center gap-1"
            >
              Mercado Pago Developers <ExternalLink size={11} />
            </a>
            . Depois de salvar, configure o webhook do painel do Mercado Pago apontando pra URL de webhook do seu sistema.
          </p>
          <div className="relative">
            <input
              type={mostrarMp ? 'text' : 'password'}
              className="w-full bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white placeholder-steel-500 focus:outline-none focus:border-ember-500"
              placeholder={config?.mercadopago.proprio_da_academia ? 'Novo token (deixe vazio pra manter o atual)' : 'Cole seu access token do Mercado Pago'}
              value={mpToken}
              onChange={(e) => setMpToken(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setMostrarMp(!mostrarMp)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-steel-500 hover:text-steel-300"
            >
              {mostrarMp ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {config?.mercadopago.proprio_da_academia && (
            <button type="button" onClick={() => remover('mercadopago')} className="text-rose-400 hover:underline text-xs mt-2">
              Remover token do Mercado Pago
            </button>
          )}
        </CartaoProvedor>

        <div className="bg-graphite-900 border border-graphite-800 rounded-xl p-5">
          <h2 className="font-display text-lg font-semibold text-white mb-3">Qual usar?</h2>
          <p className="text-steel-500 text-xs mb-3">
            Se você configurar os dois, escolha qual fica ativo pra novas cobranças. Cobranças já emitidas continuam sendo consultadas no gateway onde nasceram, mesmo se você trocar depois.
          </p>
          <select
            className="bg-graphite-800 border border-graphite-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-ember-500"
            value={provedorPreferido}
            onChange={(e) => setProvedorPreferido(e.target.value)}
          >
            <option value="">Automático (usa o que estiver configurado)</option>
            <option value="asaas">Sempre Asaas</option>
            <option value="mercadopago">Sempre Mercado Pago</option>
          </select>
        </div>

        {mensagem && <p className={`text-sm ${mensagem.ok ? 'text-mint-400' : 'text-rose-400'}`}>{mensagem.texto}</p>}

        <button
          type="submit"
          disabled={salvando}
          className="flex items-center gap-2 bg-ember-500 hover:bg-ember-600 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </div>
  );
}
