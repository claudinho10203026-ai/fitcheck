import axios from 'axios';

const CHAVE_TOKEN = 'academia_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Anexa o token de login (JWT do nosso backend) em toda requisição.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(CHAVE_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Se a API responder 401 (sessão expirada/inválida), desloga o usuário.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(CHAVE_TOKEN);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { CHAVE_TOKEN };