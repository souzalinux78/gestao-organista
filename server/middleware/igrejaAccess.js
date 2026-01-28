/**
 * Middleware para verificar acesso do usuário a uma igreja
 * Elimina duplicação de código em múltiplas rotas
 */

const { getUserIgrejas } = require('./auth');

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
    
    // Obter igrejas do usuário
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    
    // Verificar acesso (admin tem acesso a todas)
    const temAcesso = req.user.role === 'admin' || igrejas.some(i => i.id === igrejaIdInt);
    
    if (!temAcesso) {
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
    
    // Verificar acesso à igreja
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    const temAcesso = req.user.role === 'admin' || igrejas.some(i => i.id === igrejaId);
    
    if (!temAcesso) {
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
