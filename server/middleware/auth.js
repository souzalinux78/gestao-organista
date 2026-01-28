const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { getConfig } = require('../config/env');
const { cached, invalidate } = require('../utils/cache');
const logger = require('../utils/logger');

// Middleware de autenticação
const authenticate = async (req, res, next) => {
  const authStart = Date.now();
  const path = req.path || req.url;
  
  try {
    // Log da requisição
    if (path.includes('organistas') && req.method === 'POST') {
      console.log(`[AUTH] Iniciando autenticação para POST ${path}`);
    }
    
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.session?.token;

    if (!token) {
      console.log(`[AUTH] Token não fornecido para ${req.method} ${path}`);
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    // Obter JWT_SECRET validado (sem fallback inseguro)
    const envConfig = getConfig();
    const decoded = jwt.verify(token, envConfig.JWT_SECRET);
    
    if (path.includes('organistas') && req.method === 'POST') {
      console.log(`[AUTH] Token válido - UserId: ${decoded.userId}`);
    }
    
    // Buscar usuário no banco (com timeout reduzido)
    const pool = db.getDb();
    const dbTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 8000);
    
    const queryStart = Date.now();
    // Usar SELECT * para ser compatível mesmo se tipo_usuario não existir ainda
    const [users] = await pool.execute({
      sql: 'SELECT * FROM usuarios WHERE id = ? LIMIT 1',
      values: [decoded.userId],
      timeout: dbTimeout
    });
    
    if (path.includes('organistas') && req.method === 'POST') {
      console.log(`[AUTH] Query usuário executada em ${Date.now() - queryStart}ms`);
    }

    if (users.length === 0 || !users[0].ativo) {
      console.log(`[AUTH] Usuário inválido ou inativo - UserId: ${decoded.userId}`);
      return res.status(401).json({ error: 'Usuário inválido ou inativo' });
    }

    // Verificar se usuário está aprovado (exceto admin que sempre está aprovado)
    if (users[0].role !== 'admin' && !users[0].aprovado) {
      console.log(`[AUTH] Usuário não aprovado - UserId: ${decoded.userId}`);
      return res.status(403).json({ 
        error: 'Sua conta ainda não foi aprovada pelo administrador. Aguarde a aprovação para acessar o sistema.' 
      });
    }

    // Garantir que tipo_usuario e tenant_id existem (podem ser null se as colunas não existirem)
    req.user = {
      ...users[0],
      tipo_usuario: users[0].tipo_usuario || null,
      tenant_id: users[0].tenant_id || null,
      // Se tenant_id não vier do banco, tentar do JWT (para compatibilidade)
      tenantId: decoded.tenantId || users[0].tenant_id || null
    };
    
    if (path.includes('organistas') && req.method === 'POST') {
      console.log(`[AUTH] Autenticação concluída em ${Date.now() - authStart}ms - Usuário: ${users[0].nome} (${users[0].role})`);
    }
    
    next();
  } catch (error) {
    const authTime = Date.now() - authStart;
    console.error(`[AUTH] Erro na autenticação (${authTime}ms) para ${req.method} ${path}:`, {
      message: error.message,
      code: error.code,
      name: error.name
    });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    
    // Se for timeout do banco
    if (error.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ error: 'Banco de dados demorou para responder durante autenticação' });
    }
    
    return res.status(401).json({ error: 'Erro na autenticação' });
  }
};

// Middleware para verificar se é admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
  next();
};

// Middleware para verificar acesso à igreja
const checkIgrejaAccess = async (req, res, next) => {
  try {
    // Admin tem acesso a todas as igrejas
    if (req.user.role === 'admin') {
      return next();
    }

    const igrejaId = req.params.igreja_id || req.body.igreja_id || req.query.igreja_id;
    
    if (!igrejaId) {
      return res.status(400).json({ error: 'ID da igreja não fornecido' });
    }

    const pool = db.getDb();
    const [associations] = await pool.execute(
      'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
      [req.user.id, igrejaId]
    );

    if (associations.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta igreja' });
    }

    req.userIgrejaId = parseInt(igrejaId);
    next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Função auxiliar para obter igrejas do usuário (com cache e filtro de tenant)
const getUserIgrejas = async (userId, isAdmin, tenantId = null) => {
  const cacheKey = isAdmin && !tenantId ? 'igrejas:admin' : `igrejas:user:${userId}:tenant:${tenantId || 'null'}`;
  const cacheTTL = 2 * 60 * 1000; // 2 minutos de cache
  
  return cached(cacheKey, async () => {
    const pool = db.getDb();
    const dbTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 8000);
    
    try {
      // Verificar se coluna tenant_id existe em igrejas
      const { cachedColumnExists } = require('../utils/cache');
      const temTenantId = await cachedColumnExists('igrejas', 'tenant_id');
      
      if (isAdmin && !tenantId) {
        // Admin sem tenant específico = acesso global (todos os tenants)
        if (temTenantId) {
          const [igrejas] = await pool.execute({
            sql: 'SELECT * FROM igrejas ORDER BY nome',
            timeout: dbTimeout
          });
          return igrejas || [];
        } else {
          // Se coluna não existe, retornar todas (compatibilidade)
          const [igrejas] = await pool.execute({
            sql: 'SELECT * FROM igrejas ORDER BY nome',
            timeout: dbTimeout
          });
          return igrejas || [];
        }
      } else {
        // Usuário comum ou admin com tenant específico = filtrar por tenant_id
        let sql, values;
        
        if (temTenantId && tenantId) {
          // Filtrar por tenant_id se disponível
          sql = `SELECT i.* 
                 FROM igrejas i
                 INNER JOIN usuario_igreja ui ON i.id = ui.igreja_id
                 WHERE ui.usuario_id = ? AND i.tenant_id = ?
                 ORDER BY i.nome
                 LIMIT 100`;
          values = [userId, tenantId];
        } else if (temTenantId && !tenantId) {
          // Se tenant_id existe mas não foi fornecido, retornar vazio (segurança)
          return [];
        } else {
          // Se coluna não existe, usar query antiga (compatibilidade)
          sql = `SELECT i.* 
                 FROM igrejas i
                 INNER JOIN usuario_igreja ui ON i.id = ui.igreja_id
                 WHERE ui.usuario_id = ?
                 ORDER BY i.nome
                 LIMIT 100`;
          values = [userId];
        }
        
        const [igrejas] = await pool.execute({
          sql,
          values,
          timeout: dbTimeout
        });
        return igrejas || [];
      }
    } catch (error) {
      logger.error(`Erro em getUserIgrejas para usuário ${userId}`, { 
        userId, 
        isAdmin, 
        tenantId,
        error: error.message 
      });
      // Retornar array vazio em caso de erro para não quebrar o fluxo
      return [];
    }
  }, cacheTTL);
};

/**
 * Invalidar cache de igrejas (chamar quando igrejas forem criadas/atualizadas/deletadas)
 */
const invalidateIgrejasCache = (userId = null) => {
  if (userId) {
    invalidate(`igrejas:user:${userId}`);
  } else {
    // Invalidar cache de admin e todos os usuários
    invalidate('igrejas:');
  }
};

module.exports = {
  authenticate,
  isAdmin,
  checkIgrejaAccess,
  getUserIgrejas,
  invalidateIgrejasCache
};
