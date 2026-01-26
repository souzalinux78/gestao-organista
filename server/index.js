const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware de log de requisições (apenas para debug)
app.use((req, res, next) => {
  if (req.path.includes('organistas') && req.method === 'POST') {
    console.log(`[REQUEST] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  }
  next();
});

// Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', apiLimiter);
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
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

// Servir arquivos estáticos do build do React (apenas em produção)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/build');
  
  // Servir arquivos estáticos com headers anti-cache para HTML
  app.use(express.static(buildPath, {
    maxAge: 0, // Sem cache para garantir atualizações
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      // Para arquivos HTML, não usar cache
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // Para CSS e JS, usar cache curto mas com versionamento
      if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }
    }
  }));
  
  // Todas as rotas não-API servem o index.html (SPA)
  app.get('*', (req, res, next) => {
    // Ignorar rotas da API
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    // Servir index.html com headers anti-cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

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
