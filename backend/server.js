require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { requireAuth } = require('./middleware/authMiddleware');

const authRoutes = require('./routes/auth.routes');
const funcionariosRoutes = require('./routes/funcionarios.routes');
const alunosRoutes = require('./routes/alunos.routes');
const planosRoutes = require('./routes/planos.routes');
const matriculasRoutes = require('./routes/matriculas.routes');
const mensalidadesRoutes = require('./routes/mensalidades.routes');
const caixaRoutes = require('./routes/caixa.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const agendamentosRoutes = require('./routes/agendamentos.routes');
const acessoRoutes = require('./routes/acesso.routes');
const webhooksRoutes = require('./routes/webhooks.routes');

if (!process.env.JWT_SECRET) {
  console.warn(
    '[aviso] JWT_SECRET não configurado no .env do backend. Defina uma string ' +
    'aleatória longa (ex: openssl rand -hex 32) antes de usar em produção.'
  );
}

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '8mb' })); // fotos de aluno chegam em base64 no body

// Healthcheck simples (não exige login) - útil para checar se a API está de pé
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Login não exige token (é aqui que ele é gerado)
app.use('/api/auth', authRoutes);

// Webhooks são chamados pelo Mercado Pago, não pelo frontend, então não
// exigem o token de login do usuário.
app.use('/api/webhooks', webhooksRoutes);

// /api/acesso tem uma rota (verificar) usada pelo hardware da catraca, que
// se autentica por chave própria em vez de login de funcionário - por isso
// não leva o requireAuth aqui; cada sub-rota do arquivo decide por si.
app.use('/api/acesso', acessoRoutes);

// A partir daqui, todas as rotas exigem um funcionário autenticado.
// Cada rota, internamente, também filtra os dados pela academia do
// funcionário logado e checa a permissão dele na tela (ver middleware/authorize.js).
app.use('/api/funcionarios', requireAuth, funcionariosRoutes);
app.use('/api/alunos', requireAuth, alunosRoutes);
app.use('/api/planos', requireAuth, planosRoutes);
app.use('/api/matriculas', requireAuth, matriculasRoutes);
app.use('/api/mensalidades', requireAuth, mensalidadesRoutes);
app.use('/api/caixa', requireAuth, caixaRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/agendamentos', requireAuth, agendamentosRoutes);

// Tratamento de rota não encontrada
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});
const path = require('path');

// 1. Aponta para a pasta onde o build do frontend foi gerado (ex: dist ou build)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// 2. Qualquer rota que NÃO seja de API vai entregar o index.html do frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API da academia rodando em http://localhost:${PORT}`);
});
