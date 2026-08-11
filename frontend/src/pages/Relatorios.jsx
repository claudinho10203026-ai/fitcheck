import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Phone, Mail } from 'lucide-react';
import api from '../lib/api';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(data) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

function AbaInadimplencia() {
  const [linhas, setLinhas] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/dashboard/inadimplencia').then((res) => setLinhas(res.data)).finally(() => setCarregando(false));
  }, []);

  const filtradas = linhas.filter((m) => m.alunos?.nome?.toLowerCase().includes(busca.toLowerCase()));
  const totalAtrasado = filtradas.reduce((s, m) => s + Number(m.valor), 0);

  return (
    <div>
      <p className="text-steel-400 text-sm mb-5">
        {filtradas.length} mensalidade{filtradas.length !== 1 && 's'} em atraso · total{' '}
        <span className="text-rose-400 font-medium">{formatarMoeda(totalAtrasado)}</span>
      </p>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" size={16} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar aluno..."
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-graphite-900 border border-graphite-800 text-white text-sm placeholder-steel-500 focus:outline-none focus:ring-2 focus:ring-ember-500"
        />
      </div>

      <div className="bg-graphite-900 border border-graphite-800 rounded-2xl overflow-hidden">
        {carregando ? (
          <p className="text-steel-400 text-sm p-6">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-steel-500 text-sm p-6 text-center">Nenhum aluno em atraso. 🎉</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-800 text-left text-steel-400">
                <th className="font-medium px-5 py-3">Aluno</th>
                <th className="font-medium px-5 py-3">Contato</th>
                <th className="font-medium px-5 py-3">Vencimento</th>
                <th className="font-medium px-5 py-3">Dias em atraso</th>
                <th className="font-medium px-5 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((m) => (
                <tr key={m.id} className="border-b border-graphite-800 last:border-0">
                  <td className="px-5 py-3">
                    <Link to={`/alunos/${m.alunos?.id}`} className="text-white font-medium hover:text-ember-400">
                      {m.alunos?.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-steel-400">
                    <div className="flex items-center gap-3 text-xs">
                      {m.alunos?.telefone && <span className="flex items-center gap-1"><Phone size={12} /> {m.alunos.telefone}</span>}
                      {m.alunos?.email && <span className="flex items-center gap-1"><Mail size={12} /> {m.alunos.email}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-steel-400">{formatarData(m.data_vencimento)}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-rose-500/15 text-rose-400">{m.dias_atraso} dias</span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-rose-400 tabular">{formatarMoeda(m.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function Relatorios() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-white">Relatórios</h1>
        <p className="text-steel-400 text-sm mt-1">Inadimplência dos alunos</p>
        <p className="text-steel-500 text-xs mt-1">
          Procurando o controle de acesso/catraca? Ele agora tem tela própria:{' '}
          <Link to="/acesso" className="text-ember-400 hover:underline">
            Controle de Acesso
          </Link>
          .
        </p>
      </div>

      <AbaInadimplencia />
    </div>
  );
}
