/**
 * Middleware para verificar acesso do usuário a uma igreja
 * Elimina duplicação de código em múltiplas rotas
 */

const { getUserIgrejas } = require('./auth');
const { getTenantId } = require('./tenantResolver');

/**
 * Verifica se o usuário tem acesso à igreja especificada
 * Adiciona req.igrejaId ao request se o acesso for permitido
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
async function checkIgrejaAccess(req, res, next) {
  try {
    // Tentar obter igreja_id de diferentes lugares
    const igrejaId = req.params.igreja_id || req.body.igreja_id || req.query.igreja_id;
    
    if (!igrejaId) {
      return res.status(400).json({ error: 'igreja_id é obrigatório' });
    }
    
    const igrejaIdInt = parseInt(igrejaId);
    if (isNaN(igrejaIdInt)) {
      return res.status(400).json({ error: 'igreja_id deve ser um número válido' });
    }
    
    // Obter tenant_id do request (garantir que não seja null indevidamente)
    const tenantId = getTenantId(req);
    
    // Obter igrejas do usuário (com tenant_id se disponível)
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    
    // Verificar acesso (admin tem acesso a todas)
    const temAcesso = req.user.role === 'admin' || igrejas.some(i => i.id === igrejaIdInt);
    
    if (!temAcesso) {
      // Log detalhado para debug (ajuda a identificar problemas de tenant ou vínculo)
      console.error('[igrejaAccess] Acesso negado:', {
        userId: req.user.id,
        igrejaId: igrejaIdInt,
        tenantId: tenantId,
        role: req.user.role,
        igrejasDoUsuario: igrejas.map(i => i.id),
        body: req.body,
        params: req.params,
        query: req.query
      });
      return res.status(403).json({ error: 'Acesso negado a esta igreja' });
    }
    
    // Adicionar igrejaId ao request para uso posterior
    req.igrejaId = igrejaIdInt;
    next();
  } catch (error) {
    console.error('[igrejaAccess] Erro ao verificar acesso:', error);
    res.status(500).json({ error: 'Erro ao verificar acesso à igreja' });
  }
}

/**
 * Verifica acesso a um rodízio através da igreja associada
 * Útil para rotas que recebem rodizio_id em vez de igreja_id
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
async function checkRodizioAccess(req, res, next) {
  try {
    const pool = require('../database/db').getDb();
    const rodizioId = req.params.id || req.params.rodizio_id;
    
    if (!rodizioId) {
      return res.status(400).json({ error: 'rodizio_id é obrigatório' });
    }
    
    // Buscar igreja do rodízio
    const [rodizios] = await pool.execute(
      'SELECT igreja_id FROM rodizios WHERE id = ?',
      [rodizioId]
    );
    
    if (rodizios.length === 0) {
      return res.status(404).json({ error: 'Rodízio não encontrado' });
    }
    
    const igrejaId = rodizios[0].igreja_id;
    
    // CORREÇÃO: Obter tenant_id do request para verificação correta
    const tenantId = getTenantId(req);
    
    // Verificar acesso à igreja (com tenant_id)
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    const temAcesso = req.user.role === 'admin' || igrejas.some(i => i.id === igrejaId);
    
    if (!temAcesso) {
      console.error('[igrejaAccess] Acesso negado ao rodízio:', {
        userId: req.user.id,
        rodizioId: rodizioId,
        igrejaId: igrejaId,
        tenantId: tenantId,
        role: req.user.role,
        igrejasDoUsuario: igrejas.map(i => i.id)
      });
      return res.status(403).json({ error: 'Acesso negado a este rodízio' });
    }
    
    // Adicionar ao request
    req.igrejaId = igrejaId;
    req.rodizioId = parseInt(rodizioId);
    next();
  } catch (error) {
    console.error('[igrejaAccess] Erro ao verificar acesso ao rodízio:', error);
    res.status(500).json({ error: 'Erro ao verificar acesso ao rodízio' });
  }
}

module.exports = {
  checkIgrejaAccess,
  checkRodizioAccess
};
