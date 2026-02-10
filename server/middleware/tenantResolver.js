/**
 * Middleware tenantResolver
 * FASE 3: Resolução de Tenant
 * 
 * Extrai tenant_id do JWT e adiciona ao request
 * Garante que todas as rotas tenham acesso ao tenant_id do usuário
 * 
 * IMPORTANTE: Requer que o middleware authenticate seja executado antes
 */

const logger = require('../utils/logger');

/**
 * Middleware para resolver tenant do usuário autenticado
 * Adiciona req.tenantId ao request
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
function tenantResolver(req, res, next) {
  try {
    // req.user deve estar disponível (middleware authenticate deve ter executado antes)
    if (!req.user) {
      logger.warn('tenantResolver chamado sem req.user. Middleware authenticate deve ser executado antes.');
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // ✅ Admin deve ter acesso global (multi-tenant): não restringir por tenant_id
    // Motivo: admin normalmente precisa listar/gerenciar tudo.
    // Usuários comuns continuam restritos ao próprio tenant.
    if (req.user.role === 'admin') {
      req.tenantId = null;
      req.user.tenantId = null;
      return next();
    }
    
    // Obter tenant_id do usuário
    // Pode vir de:
    // 1. req.user.tenant_id (do banco de dados)
    // 2. req.user.tenantId (do JWT, se adicionado)
    const tenantId = req.user.tenant_id || req.user.tenantId || null;
    
    if (!tenantId) {
      // CORREÇÃO: Durante migração, permitir que usuários sem tenant_id continuem
      // O getUserIgrejas já tem fallback para lidar com isso
      // Bloquear apenas se realmente necessário (pode ser configurável no futuro)
      logger.warn(`Usuário ${req.user.id} sem tenant_id - usando fallback (migração em andamento)`);
      // Não bloquear - permitir que continue com tenantId = null
      // O getUserIgrejas vai usar fallback sem filtro de tenant
    }
    
    // Adicionar tenant_id ao request (pode ser null durante migração)
    req.tenantId = tenantId;
    
    // Adicionar também ao req.user para facilitar acesso
    req.user.tenantId = tenantId;
    
    if (tenantId) {
      logger.debug(`Tenant resolvido: ${tenantId} para usuário ${req.user.id}`);
    } else {
      logger.debug(`Usuário ${req.user.id} sem tenant_id - usando modo compatibilidade`);
    }
    
    next();
  } catch (error) {
    logger.error('Erro no tenantResolver:', error);
    return res.status(500).json({ error: 'Erro ao resolver tenant' });
  }
}

/**
 * Helper para obter tenant_id do request
 * Retorna null se for admin (acesso global)
 * 
 * @param {Object} req - Request object
 * @returns {number|null} - tenant_id ou null
 */
function getTenantId(req) {
  // Admin é global
  if (req.user && req.user.role === 'admin') return null;
  
  return req.tenantId || null;
}

/**
 * Helper para verificar se usuário tem acesso ao tenant
 * 
 * @param {Object} req - Request object
 * @param {number} tenantId - tenant_id a verificar
 * @returns {boolean} - true se tem acesso
 */
function hasTenantAccess(req, tenantId) {
  // Admin tem acesso a todos os tenants
  if (req.user && req.user.role === 'admin') {
    return true;
  }
  
  // Usuário comum só tem acesso ao seu próprio tenant
  return req.tenantId === tenantId;
}

/**
 * Middleware para garantir que usuário acessa apenas seu tenant
 * Útil para rotas que recebem tenant_id como parâmetro
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
function requireTenantAccess(req, res, next) {
  try {
    const requestedTenantId = req.params.tenant_id || req.body.tenant_id || req.query.tenant_id;
    
    if (!requestedTenantId) {
      return res.status(400).json({ error: 'tenant_id é obrigatório' });
    }
    
    if (!hasTenantAccess(req, parseInt(requestedTenantId))) {
      return res.status(403).json({ error: 'Acesso negado a este tenant' });
    }
    
    next();
  } catch (error) {
    logger.error('Erro em requireTenantAccess:', error);
    return res.status(500).json({ error: 'Erro ao verificar acesso ao tenant' });
  }
}

module.exports = {
  tenantResolver,
  getTenantId,
  hasTenantAccess,
  requireTenantAccess
};
