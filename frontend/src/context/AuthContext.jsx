import { createContext, useContext, useEffect, useState } from 'react';
import api, { CHAVE_TOKEN } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [funcionario, setFuncionario] = useState(null);
  const [academia, setAcademia] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Ao carregar o app, se já existir um token salvo, confirma com o backend
  // (GET /me) que ele ainda é válido e busca as permissões mais recentes -
  // assim, se o admin mudou a permissão de alguém, ela vale já no próximo refresh.
  useEffect(() => {
    async function restaurarSessao() {
      const token = localStorage.getItem(CHAVE_TOKEN);
      if (!token) {
        setCarregando(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setFuncionario(data.funcionario);
        setAcademia(data.academia);
      } catch (err) {
        localStorage.removeItem(CHAVE_TOKEN);
      } finally {
        setCarregando(false);
      }
    }
    restaurarSessao();
  }, []);

  async function entrar(nomeAcademia, usuario, senha) {
    const { data } = await api.post('/auth/login', { nome_academia: nomeAcademia, usuario, senha });
    localStorage.setItem(CHAVE_TOKEN, data.token);
    setFuncionario(data.funcionario);
    setAcademia(data.academia);
    return data;
  }

  function sair() {
    localStorage.removeItem(CHAVE_TOKEN);
    setFuncionario(null);
    setAcademia(null);
  }

  const valor = {
    funcionario,
    academia,
    autenticado: Boolean(funcionario),
    carregando,
    entrar,
    sair,
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa ser usado dentro de um AuthProvider');
  return contexto;
}
