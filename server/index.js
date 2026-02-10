const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

// Validar variáveis de ambiente ANTES de qualquer coisa
const { getConfig } = require('./config/env');
let envConfig;
try {
  envConfig = getConfig();
  console.log('✅ Variáveis de ambiente validadas com sucesso');
} catch (error) {
  console.error('❌ Erro na validação de variáveis de ambiente:', error.message);
  process.exit(1);
}

// Dependências opcionais (segurança) - não quebram se não estiverem instaladas
let helmet, rateLimit, loginLimiter, apiLimiter;
try {
  helmet = require('helmet');
  rateLimit = require('express-rate-limit');
} catch (e) {
  console.warn('[WARN] Dependências de segurança não instaladas. Execute: npm install helmet express-rate-limit');
}

const app = express();
const PORT = envConfig.PORT || 5001;

// Importante: estamos atrás do Nginx (reverse proxy). Isso evita erros do express-rate-limit
// e garante que IP/headers (X-Forwarded-For) sejam interpretados corretamente.
app.set('trust proxy', 1);

// Middleware de log de requisições (apenas para debug)
app.use((req, res, next) => {
  if (req.path.includes('organistas') && req.method === 'POST') {
    console.log(`[REQUEST] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  }
  next();
});

// Middlewares de segurança (opcionais)
if (helmet) {
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
  console.log('[INFO] Helmet (segurança) ativado');
} else {
  console.warn('[WARN] Helmet não disponível - execute: npm install helmet');
}

if (rateLimit) {
  // Rate limit específico para login (mais permissivo para tentativas legítimas)
  loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20, // máximo 20 tentativas de login por 15 minutos (previne brute force)
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
    skipSuccessfulRequests: true // Não contar requisições bem-sucedidas
  });
  
  // Rate limit geral para outras rotas da API
  apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 500, // Aumentado para 500 requisições por 15 minutos
    standardHeaders: true,
    legacyHeaders: false
  });
  
  console.log('[INFO] Rate limiting ativado');
  console.log('[INFO] Login: máximo 20 tentativas por 15 minutos');
  console.log('[INFO] API geral: máximo 500 requisições por 15 minutos');
} else {
  console.warn('[WARN] Rate limiting não disponível - execute: npm install express-rate-limit');
}
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({
  secret: envConfig.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // HTTPS em produção
    httpOnly: true, 
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    sameSite: 'strict' // Proteção CSRF
  }
}));

// Importar middlewares de erro
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Importar rotas
const authRoutes = require('./routes/auth');
const organistasRoutes = require('./routes/organistas');
const igrejasRoutes = require('./routes/igrejas');
const cultosRoutes = require('./routes/cultos');
const rodiziosRoutes = require('./routes/rodizios');
const notificacoesRoutes = require('./routes/notificacoes');
const diagnosticoRoutes = require('./routes/diagnostico');
const adminRoutes = require('./routes/admin');
const configuracoesRoutes = require('./routes/configuracoes');

// Rotas públicas
// Aplicar rate limit específico para login usando middleware condicional
if (rateLimit && loginLimiter) {
  // Middleware condicional: aplicar rate limit apenas na rota POST /api/auth/login
  app.use('/api/auth', (req, res, next) => {
    if (req.path === '/login' && req.method === 'POST') {
      return loginLimiter(req, res, next);
    }
    next();
  });
}
// Middleware de logging de requisições (apenas em desenvolvimento ou se LOG_LEVEL=debug)
// Deve vir ANTES das rotas para capturar todas as requisições
if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.http(req, res, duration);
    });
    next();
  });
}

app.use('/api/auth', authRoutes);

// Rotas protegidas (aplicar rate limit geral apenas nas rotas protegidas)
if (rateLimit && apiLimiter) {
  app.use('/api/organistas', apiLimiter, organistasRoutes);
  app.use('/api/igrejas', apiLimiter, igrejasRoutes);
  app.use('/api/cultos', apiLimiter, cultosRoutes);
  app.use('/api/rodizios', apiLimiter, rodiziosRoutes);
  app.use('/api/notificacoes', apiLimiter, notificacoesRoutes);
  app.use('/api/diagnostico', apiLimiter, diagnosticoRoutes);
  app.use('/api/admin', apiLimiter, adminRoutes);
  app.use('/api/configuracoes', apiLimiter, configuracoesRoutes);
} else {
  // Se rate limit não estiver disponível, usar rotas sem rate limit
  app.use('/api/organistas', organistasRoutes);
  app.use('/api/igrejas', igrejasRoutes);
  app.use('/api/cultos', cultosRoutes);
  app.use('/api/rodizios', rodiziosRoutes);
  app.use('/api/notificacoes', notificacoesRoutes);
  app.use('/api/diagnostico', diagnosticoRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/configuracoes', configuracoesRoutes);
}

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sistema de Gestão de Organistas' });
});

// Diagnóstico de banco (para debug - retorna erro exato se falhar)
app.get('/api/diagnostico-db', async (req, res) => {
  try {
    const database = require('./database/db');
    const pool = database.getDb();
    await pool.execute('SELECT 1');
    res.json({ ok: true, message: 'Conexão com o banco OK' });
  } catch (err) {
    console.error('[diagnostico-db]', err.message);
    res.status(500).json({ ok: false, error: err.message, code: err.code });
  }
});

// Em desenvolvimento: avisar quem acessar a porta do backend para usar o frontend
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.status(200).json({
      message: 'Esta é a API (backend). Para usar o sistema, abra o frontend em: http://localhost:3000',
      api: 'Backend Gestão de Organistas',
      frontend: 'http://localhost:3000',
      health: '/api/health',
      login: 'Use http://localhost:3000/login e crie o admin com: npm run create-admin'
    });
  });
  app.get('/login', (req, res) => {
    res.redirect(302, 'http://localhost:3000/login');
  });
}

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

// Middleware de erro 404 (deve vir ANTES do errorHandler, mas DEPOIS das rotas)
app.use(notFoundHandler);

// Middleware de tratamento de erros (deve ser o ÚLTIMO)
app.use(errorHandler);

// Inicializar banco e depois subir o servidor (evita 500 nas primeiras requisições)
const db = require('./database/db');
const scheduler = require('./services/scheduler');

async function start() {
  try {
    await db.init();
    scheduler.init();
    app.listen(PORT, () => {
      logger.info(`Servidor rodando na porta ${PORT}`, {
        port: PORT,
        env: process.env.NODE_ENV || 'development'
      });
      if (!helmet) logger.warn('Helmet não disponível - segurança reduzida');
      if (!rateLimit) logger.warn('Rate limiting não disponível - execute: npm install express-rate-limit');
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Porta ${PORT} já está em uso`, { port: PORT, code: err.code });
        logger.info('Solução: Pare o processo que está usando a porta ou mude a porta no .env');
      } else {
        logger.error('Erro ao iniciar servidor', { error: err.message, code: err.code, stack: err.stack });
      }
      process.exit(1);
    });
  } catch (err) {
    logger.error('Erro ao inicializar banco de dados', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

start();
