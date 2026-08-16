require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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
const dispositivoPushRoutes = require('./routes/dispositivoPush.routes');
const configuracaoPagamentoRoutes = require('./routes/configuracaoPagamento.routes');
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

// Sem /api e sem login: alguns leitores biométricos (protocolo ADMS/iClock)
// têm esses caminhos fixos no firmware e não têm como customizar. Ver
// backend/routes/dispositivoPush.routes.js para o contexto completo.
app.use('/iclock', dispositivoPushRoutes);

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
app.use('/api/configuracao-pagamento', requireAuth, configuracaoPagamentoRoutes);

// ============================================================================
// SERVIR O FRONTEND (opcional, modo "um processo só")
// ============================================================================
// Se você rodou `npm run build` dentro de frontend/ (isso gera a pasta
// frontend/dist), o backend serve o site pronto direto por aqui - assim dá
// pra subir o sistema inteiro (site + API) com UM comando só (`npm start`
// aqui no backend), o que é mais simples em hospedagens que só rodam um
// processo Node (ex: VPS simples, Railway, Render).
//
// Se a pasta frontend/dist NÃO existir (você ainda não rodou o build, ou tá
// rodando o frontend separado com `npm run dev` na porta 5173 - o normal em
// desenvolvimento), essa parte simplesmente não faz nada e o backend continua
// só como API, do jeito que já era.
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  console.log('[frontend] pasta frontend/dist encontrada - servindo o site junto com a API.');
  app.use(express.static(frontendDist));

  // Qualquer rota que não seja /api/* nem /iclock/* devolve o index.html,
  // pra o React Router assumir a navegação no navegador (ex: dar F5 direto
  // em /alunos não pode cair num 404 do Express).
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/iclock')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  console.log(
    '[frontend] pasta frontend/dist não encontrada - rodando só como API. ' +
    'Rode "npm run build" dentro de frontend/ se quiser servir o site por aqui também, ' +
    'ou rode o frontend separado com "npm run dev" (modo desenvolvimento).'
  );
}

// Tratamento de rota não encontrada
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API da academia rodando em http://localhost:${PORT}`);
});