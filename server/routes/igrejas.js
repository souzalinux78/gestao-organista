const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, getUserIgrejas, invalidateIgrejasCache } = require('../middleware/auth');
const { tenantResolver, getTenantId } = require('../middleware/tenantResolver');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Listar igrejas (filtrado por usuário e tenant, admin vê todas se sem tenant)
router.get('/', authenticate, tenantResolver, async (req, res) => {
  try {
    const pool = db.getDb();
    const tenantId = getTenantId(req);
    
    // Verificar se coluna tenant_id existe
    const { cachedColumnExists } = require('../utils/cache');
    const temTenantId = await cachedColumnExists('igrejas', 'tenant_id');
    
    // Admin vê todas as igrejas com informações adicionais
    // Se admin tem tenantId null, vê todas (acesso global)
    // Se admin tem tenantId específico, filtra por tenant
    if (req.user.role === 'admin' && !tenantId) {
      // Admin sem tenant = acesso global
      const [igrejas] = await pool.execute(
        `SELECT 
          i.id, i.nome, i.endereco, 
          i.encarregado_local_nome, i.encarregado_local_telefone,
          i.encarregado_regional_nome, i.encarregado_regional_telefone,
          i.mesma_organista_ambas_funcoes, i.rodizio_ciclo,
          i.created_at,
          COUNT(DISTINCT oi.organista_id) as total_organistas,
          COUNT(DISTINCT ui.usuario_id) as total_usuarios,
          COUNT(DISTINCT c.id) as total_cultos
         FROM igrejas i
         LEFT JOIN organistas_igreja oi ON i.id = oi.igreja_id
         LEFT JOIN usuario_igreja ui ON i.id = ui.igreja_id
         LEFT JOIN cultos c ON i.id = c.igreja_id AND c.ativo = 1
         ${temTenantId ? '' : ''}
         GROUP BY i.id, i.nome, i.endereco, 
                  i.encarregado_local_nome, i.encarregado_local_telefone,
                  i.encarregado_regional_nome, i.encarregado_regional_telefone,
                  i.mesma_organista_ambas_funcoes, i.rodizio_ciclo, i.created_at
         ORDER BY i.nome`
      );
      res.json(igrejas);
    } else {
      // Usuário comum ou admin com tenant específico = filtrar por tenant
      const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
      res.json(igrejas);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar igreja por ID (com verificação de acesso)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    
    // Admin pode acessar qualquer igreja
    if (req.user.role === 'admin') {
      const [rows] = await pool.execute('SELECT * FROM igrejas WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Igreja não encontrada' });
      }
      return res.json(rows[0]);
    }
    
    // Usuário comum só pode acessar suas igrejas
    const [rows] = await pool.execute(
      `SELECT i.* FROM igrejas i
       INNER JOIN usuario_igreja ui ON i.id = ui.igreja_id
       WHERE ui.usuario_id = ? AND i.id = ?`,
      [req.user.id, req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Igreja não encontrada ou acesso negado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar nova igreja (admin ou usuário comum)
router.post('/', authenticate, tenantResolver, async (req, res) => {
  try {
    const { 
      nome, 
      endereco, 
      encarregado_local_nome, 
      encarregado_local_telefone,
      encarregado_regional_nome,
      encarregado_regional_telefone,
      mesma_organista_ambas_funcoes
    } = req.body;
    const pool = db.getDb();
    const tenantId = getTenantId(req);
    
    // Verificar se coluna tenant_id existe
    const { cachedColumnExists } = require('../utils/cache');
    const temTenantId = await cachedColumnExists('igrejas', 'tenant_id');
    
    // Validar tenant_id (obrigatório após FASE 5)
    if (temTenantId && !tenantId && req.user.role !== 'admin') {
      return res.status(400).json({ 
        error: 'tenant_id é obrigatório. Usuário deve estar associado a um tenant.' 
      });
    }
    
    // Obter tenant padrão se admin sem tenant (acesso global)
    let tenantIdParaIgreja = tenantId;
    if (temTenantId && !tenantId && req.user.role === 'admin') {
      const [tenants] = await pool.execute(
        'SELECT id FROM tenants WHERE slug = ? LIMIT 1',
        ['default']
      );
      tenantIdParaIgreja = tenants.length > 0 ? tenants[0].id : null;
    }
    
    // Criar igreja com tenant_id se disponível
    let sql, values;
    if (temTenantId && tenantIdParaIgreja) {
      sql = `INSERT INTO igrejas (
        nome, endereco, 
        encarregado_local_nome, encarregado_local_telefone,
        encarregado_regional_nome, encarregado_regional_telefone,
        mesma_organista_ambas_funcoes, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      values = [
        nome, 
        endereco || null,
        encarregado_local_nome || null,
        encarregado_local_telefone || null,
        encarregado_regional_nome || null,
        encarregado_regional_telefone || null,
        mesma_organista_ambas_funcoes ? 1 : 0,
        tenantIdParaIgreja
      ];
    } else {
      sql = `INSERT INTO igrejas (
        nome, endereco, 
        encarregado_local_nome, encarregado_local_telefone,
        encarregado_regional_nome, encarregado_regional_telefone,
        mesma_organista_ambas_funcoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      values = [
        nome, 
        endereco || null,
        encarregado_local_nome || null,
        encarregado_local_telefone || null,
        encarregado_regional_nome || null,
        encarregado_regional_telefone || null,
        mesma_organista_ambas_funcoes ? 1 : 0
      ];
    }
    
    const [result] = await pool.execute(sql, values);
    
    const igrejaId = result.insertId;
    
    // Se for usuário comum, associar automaticamente a ele
    if (req.user.role !== 'admin') {
      await pool.execute(
        'INSERT INTO usuario_igreja (usuario_id, igreja_id) VALUES (?, ?)',
        [req.user.id, igrejaId]
      );
      
      // Associar automaticamente todas as organistas que não estão associadas a nenhuma igreja
      // Isso resolve o problema de usuários que criaram organistas antes de criar uma igreja
      // Quando criam a primeira igreja, todas as organistas "órfãs" são associadas automaticamente
      const [organistasOrfas] = await pool.execute(
        `SELECT o.id, o.oficializada
         FROM organistas o
         WHERE o.id NOT IN (SELECT DISTINCT organista_id FROM organistas_igreja)
         ORDER BY o.id DESC
         LIMIT 100`
      );
      
      if (organistasOrfas.length > 0) {
        const placeholders = organistasOrfas.map(() => '(?, ?, ?)').join(', ');
        const params = organistasOrfas.flatMap((org) => [org.id, igrejaId, org.oficializada]);
        
        await pool.execute(
          `INSERT IGNORE INTO organistas_igreja (organista_id, igreja_id, oficializada) VALUES ${placeholders}`,
          params
        );
      }
    }
    
    res.json({ 
      id: igrejaId, 
      nome, 
      endereco,
      encarregado_local_nome,
      encarregado_local_telefone,
      encarregado_regional_nome,
      encarregado_regional_telefone,
      mesma_organista_ambas_funcoes: mesma_organista_ambas_funcoes ? 1 : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar igreja (apenas admin ou usuário da igreja)
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  // Admin pode atualizar qualquer igreja
  if (req.user.role !== 'admin') {
    // Usuário comum só pode atualizar suas igrejas
    const pool = db.getDb();
    const [associations] = await pool.execute(
      'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
      [req.user.id, req.params.id]
    );
    
    if (associations.length === 0) {
      throw new AppError('Acesso negado a esta igreja', 403, 'ACCESS_DENIED');
    }
  }
  
  const { 
    nome, 
    endereco, 
    encarregado_local_nome, 
    encarregado_local_telefone,
    encarregado_regional_nome,
    encarregado_regional_telefone,
    mesma_organista_ambas_funcoes
  } = req.body;
  
  if (!nome || nome.trim() === '') {
    throw new AppError('Nome da igreja é obrigatório', 400, 'VALIDATION_ERROR');
  }
  
  const pool = db.getDb();
  
  const [result] = await pool.execute(
    `UPDATE igrejas SET 
      nome = ?, endereco = ?,
      encarregado_local_nome = ?, encarregado_local_telefone = ?,
      encarregado_regional_nome = ?, encarregado_regional_telefone = ?,
      mesma_organista_ambas_funcoes = ?
    WHERE id = ?`,
    [
      nome.trim(), 
      endereco?.trim() || null,
      encarregado_local_nome?.trim() || null,
      encarregado_local_telefone?.trim() || null,
      encarregado_regional_nome?.trim() || null,
      encarregado_regional_telefone?.trim() || null,
      mesma_organista_ambas_funcoes ? 1 : 0,
      req.params.id
    ]
  );
  
  if (result.affectedRows === 0) {
    throw new AppError('Igreja não encontrada', 404, 'NOT_FOUND');
  }
  
  // Invalidar cache
  if (req.user.role === 'admin') {
    invalidateIgrejasCache();
  } else {
    invalidateIgrejasCache(req.user.id);
  }
  
  logger.info('Igreja atualizada', { igrejaId: req.params.id, userId: req.user.id });
  
  res.json({ 
    id: req.params.id, 
    nome, 
    endereco,
    encarregado_local_nome,
    encarregado_local_telefone,
    encarregado_regional_nome,
    encarregado_regional_telefone,
    mesma_organista_ambas_funcoes: mesma_organista_ambas_funcoes ? 1 : 0
  });
}));

// Deletar igreja (apenas admin)
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new AppError('Apenas administradores podem deletar igrejas', 403, 'ACCESS_DENIED');
  }
  
  const pool = db.getDb();
  const [result] = await pool.execute('DELETE FROM igrejas WHERE id = ?', [req.params.id]);
  
  if (result.affectedRows === 0) {
    throw new AppError('Igreja não encontrada', 404, 'NOT_FOUND');
  }
  
  // Invalidar cache de admin
  invalidateIgrejasCache();
  
  logger.info('Igreja deletada', { igrejaId: req.params.id, userId: req.user.id });
  
  res.json({ message: 'Igreja deletada com sucesso' });
}));

// Listar organistas oficializadas de uma igreja (com verificação de acesso)
router.get('/:id/organistas', authenticate, async (req, res) => {
  try {
    // Verificar acesso à igreja
    if (req.user.role !== 'admin') {
      const pool = db.getDb();
      const [associations] = await pool.execute(
        'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
        [req.user.id, req.params.id]
      );
      
      if (associations.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta igreja' });
      }
    }
    
    const pool = db.getDb();
    const [rows] = await pool.execute(
      `SELECT o.*, oi.oficializada as associacao_oficializada
       FROM organistas o
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
       WHERE oi.igreja_id = ? AND oi.oficializada = 1 AND o.oficializada = 1 AND o.ativa = 1
       ORDER BY oi.id ASC, oi.created_at ASC`,
      [req.params.id]
    );
    
    console.log(`[DEBUG] Organistas da igreja ${req.params.id}:`, rows.length, 'encontradas');
    
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar organista oficializada a uma igreja (com verificação de acesso)
router.post('/:id/organistas', authenticate, async (req, res) => {
  try {
    // Verificar acesso à igreja
    if (req.user.role !== 'admin') {
      const pool = db.getDb();
      const [associations] = await pool.execute(
        'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
        [req.user.id, req.params.id]
      );
      
      if (associations.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta igreja' });
      }
    }
    
    const { organista_id } = req.body;
    const pool = db.getDb();
    
    // Verificar se organista existe e está oficializada
    const [organista] = await pool.execute(
      'SELECT * FROM organistas WHERE id = ?',
      [organista_id]
    );
    
    if (organista.length === 0) {
      return res.status(404).json({ error: 'Organista não encontrada' });
    }
    
    if (organista[0].oficializada !== 1) {
      return res.status(400).json({ 
        error: 'Esta organista não está marcada como oficializada. Marque como "Oficializada" na página de Organistas primeiro.' 
      });
    }
    
    if (organista[0].ativa !== 1) {
      return res.status(400).json({ 
        error: 'Esta organista não está ativa. Marque como "Ativa" na página de Organistas primeiro.' 
      });
    }
    
    // Inserir associação
    const [result] = await pool.execute(
      'INSERT IGNORE INTO organistas_igreja (organista_id, igreja_id, oficializada) VALUES (?, ?, 1)',
      [organista_id, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Organista já está associada a esta igreja' });
    }
    
    console.log(`[DEBUG] Organista ${organista_id} associada à igreja ${req.params.id}`);
    
    res.json({ message: 'Organista oficializada adicionada à igreja com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remover organista oficializada de uma igreja (com verificação de acesso)
router.delete('/:id/organistas/:organista_id', authenticate, async (req, res) => {
  try {
    // Verificar acesso à igreja
    if (req.user.role !== 'admin') {
      const pool = db.getDb();
      const [associations] = await pool.execute(
        'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
        [req.user.id, req.params.id]
      );
      
      if (associations.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta igreja' });
      }
    }
    
    const pool = db.getDb();
    const [result] = await pool.execute(
      'DELETE FROM organistas_igreja WHERE igreja_id = ? AND organista_id = ?',
      [req.params.id, req.params.organista_id]
    );
    
    res.json({ message: 'Organista removida da igreja' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
