import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento (`npm run dev`), o frontend roda na porta 5173 e o
// backend na 3001, como dois processos separados. Pra não precisar apontar
// uma URL absoluta (o que quebra em produção - foi exatamente o bug do
// CORS em produção), o frontend sempre chama o caminho relativo `/api`, e
// esse proxy só existe pra encaminhar isso pro backend local durante o
// desenvolvimento. Em produção (backend servindo o frontend já buildado,
// mesma origem), `/api` já cai direto no backend, sem precisar de proxy
// nenhum - por isso esse bloco não existe/atua no build final.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/iclock': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});