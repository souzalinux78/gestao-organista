const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'sua-chave-secreta-session',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 dias
}));

// Importar rotas
const authRoutes = require('./routes/auth');
const organistasRoutes = require('./routes/organistas');
const igrejasRoutes = require('./routes/igrejas');
const cultosRoutes = require('./routes/cultos');
const rodiziosRoutes = require('./routes/rodizios');
const notificacoesRoutes = require('./routes/notificacoes');
const diagnosticoRoutes = require('./routes/diagnostico');

// Rotas públicas
app.use('/api/auth', authRoutes);

// Rotas protegidas
app.use('/api/organistas', organistasRoutes);
app.use('/api/igrejas', igrejasRoutes);
app.use('/api/cultos', cultosRoutes);
app.use('/api/rodizios', rodiziosRoutes);
app.use('/api/notificacoes', notificacoesRoutes);
app.use('/api/diagnostico', diagnosticoRoutes);

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sistema de Gestão de Organistas' });
});

// Inicializar banco de dados
const db = require('./database/db');
db.init().catch(err => {
  console.error('Erro ao inicializar banco de dados:', err);
  process.exit(1);
});

// Inicializar agendador de notificações
const scheduler = require('./services/scheduler');
scheduler.init();

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
