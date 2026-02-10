const express = require('express');
const router = express.Router();
const db = require('../database/db');
const cicloRepository = require('../services/cicloRepository');
const { authenticate, getUserIgrejas, invalidateIgrejasCache } = require('../middleware/auth');
const { tenantResolver, getTenantId } = require('../middleware/tenantResolver');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { getPesoDiaSemanaBr } = require('../utils/dateHelpers');

// Listar igrejas (filtrado por usuário e tenant, admin vê todas se sem tenant)
router.get('/', authenticate, tenantResolver, async (req, res) => {
  try {
    const pool = db.getDb();
    const tenantId = getTenantId(req);
    
    // Verificar se coluna tenant_id existe
    const { cachedColumnExists } = require('../utils/cache');
    const temTenantId = await cachedColumnExists('igrejas', 'tenant_id');
    
    // Admin vê todas as igrejas com informações adicionais
    if (req.user.role === 'admin' && !tenantId) {
      const temMesmaOrganista = await cachedColumnExists('igrejas', 'mesma_organista_ambas_funcoes');
      const temRodizioCiclo = await cachedColumnExists('igrejas', 'rodizio_ciclo');
      const colsExtra = [];
      if (temMesmaOrganista) colsExtra.push('i.mesma_organista_ambas_funcoes');
      if (temRodizioCiclo) colsExtra.push('i.rodizio_ciclo');
      const colsExtraStr = colsExtra.length ? ', ' + colsExtra.join(', ') : '';
      const groupByExtra = colsExtra.length ? ', ' + colsExtra.join(', ') : '';
      const [igrejas] = await pool.execute(
        `SELECT 
          i.id, i.nome, i.endereco, 
          i.encarregado_local_nome, i.encarregado_local_telefone,
          i.encarregado_regional_nome, i.encarregado_regional_telefone${colsExtraStr},
          i.created_at,
          COUNT(DISTINCT oi.organista_id) as total_organistas,
          COUNT(DISTINCT ui.usuario_id) as total_usuarios,
          COUNT(DISTINCT c.id) as total_cultos
         FROM igrejas i
         LEFT JOIN organistas_igreja oi ON i.id = oi.igreja_id
         LEFT JOIN usuario_igreja ui ON i.id = ui.igreja_id
         LEFT JOIN cultos c ON i.id = c.igreja_id AND c.ativo = 1
         GROUP BY i.id, i.nome, i.endereco, 
                  i.encarregado_local_nome, i.encarregado_local_telefone,
                  i.encarregado_regional_nome, i.encarregado_regional_telefone${groupByExtra}, i.created_at
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

// --- Gestão de Ciclos (N cultos = N ciclos) ---
// Listar ciclos da igreja (1..N conforme quantidade de cultos) e cultos para rótulos
router.get('/:id/ciclos', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id);
    if (isNaN(igrejaId)) return res.status(400).json({ error: 'ID da igreja inválido' });
    if (req.user.role !== 'admin') {
      const igrejas = await getUserIgrejas(req.user.id, false, getTenantId(req));
      if (!igrejas.some(i => i.id === igrejaId)) return res.status(403).json({ error: 'Acesso negado a esta igreja' });
    }
    const totalCiclos = await cicloRepository.getQuantidadeCultos(igrejaId);
    const pool = db.getDb();
    const [cultos] = await pool.execute(
      'SELECT id, dia_semana, hora FROM cultos WHERE igreja_id = ? AND ativo = 1 ORDER BY dia_semana, hora',
      [igrejaId]
    );
    const cultosOrdenados = [...cultos].sort((a, b) => {
      const pa = getPesoDiaSemanaBr(a.dia_semana);
      const pb = getPesoDiaSemanaBr(b.dia_semana);
      if (pa !== pb) return pa - pb;
      return (a.hora || '').localeCompare(b.hora || '');
    });
    res.json({
      igreja_id: igrejaId,
      total_ciclos: totalCiclos,
      ciclos: Array.from({ length: totalCiclos }, (_, i) => ({
        numero_ciclo: i + 1,
        culto: cultosOrdenados[i] || null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter itens de um ciclo (organistas ordenadas por posição)
router.get('/:id/ciclos/:numero', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id);
    const numero = parseInt(req.params.numero);
    if (isNaN(igrejaId) || isNaN(numero)) return res.status(400).json({ error: 'Parâmetros inválidos' });
    if (req.user.role !== 'admin') {
      const igrejas = await getUserIgrejas(req.user.id, false, getTenantId(req));
      if (!igrejas.some(i => i.id === igrejaId)) return res.status(403).json({ error: 'Acesso negado a esta igreja' });
    }
    const itens = await cicloRepository.getCicloItens(igrejaId, numero);
    res.json(itens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Salvar ordem do ciclo (body: { itens: [ { organista_id, posicao } ] })
router.put('/:id/ciclos/:numero', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id);
    const numero = parseInt(req.params.numero);
    const { itens } = req.body || {};
    if (isNaN(igrejaId) || isNaN(numero)) return res.status(400).json({ error: 'Parâmetros inválidos' });
    if (!Array.isArray(itens)) return res.status(400).json({ error: 'Body deve conter itens (array de { organista_id, posicao })' });
    if (req.user.role !== 'admin') {
      const igrejas = await getUserIgrejas(req.user.id, false, getTenantId(req));
      if (!igrejas.some(i => i.id === igrejaId)) return res.status(403).json({ error: 'Acesso negado a esta igreja' });
    }
    await cicloRepository.saveCicloItens(igrejaId, numero, itens);
    const atualizado = await cicloRepository.getCicloItens(igrejaId, numero);
    res.json({ message: 'Ciclo salvo', itens: atualizado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==============================================================================
// CORREÇÃO: Rota recriada para trazer 'ciclo' e 'ordem' explicitamente do banco
// ==============================================================================
router.get('/:id/ciclos-organistas', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id);
    if (isNaN(igrejaId)) return res.status(400).json({ error: 'ID da igreja inválido' });
    
    if (req.user.role !== 'admin') {
      const igrejas = await getUserIgrejas(req.user.id, false, getTenantId(req));
      if (!igrejas.some(i => i.id === igrejaId)) return res.status(403).json({ error: 'Acesso negado a esta igreja' });
    }

    const pool = db.getDb();
    // Consulta SQL direta que garante o retorno das colunas ciclo e ordem
    const [organistas] = await pool.execute(`
      SELECT 
        o.id, 
        o.nome, 
        o.oficializada, 
        o.ativa,
        co.ciclo, 
        co.ordem
      FROM organistas o
      JOIN ciclo_organistas co ON co.organista_id = o.id
      WHERE co.igreja_id = ?
      ORDER BY co.ciclo ASC, co.ordem ASC
    `, [igrejaId]);

    res.json(organistas);
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
    
    // Se a coluna existe mas não temos tenant, buscar novamente ou retornar erro
    if (temTenantId && !tenantIdParaIgreja) {
      const [tenantsRetry] = await pool.execute(
        'SELECT id FROM tenants WHERE slug = ? LIMIT 1',
        ['default']
      );
      tenantIdParaIgreja = tenantsRetry.length > 0 ? tenantsRetry[0].id : null;
      
      if (!tenantIdParaIgreja) {
        return res.status(500).json({ 
          error: 'Erro interno: tenant padrão não encontrado. Contate o administrador.' 
        });
      }
    }
    
    // Criar igreja com tenant_id se disponível
    let sql, values;
    if (temTenantId) {
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
    // CORREÇÃO: Remover filtros de oficializada - listar TODAS as organistas ativas vinculadas
    const [rows] = await pool.execute(
      `SELECT o.*, oi.oficializada as associacao_oficializada
       FROM organistas o
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
       WHERE oi.igreja_id = ? AND o.ativa = 1
       ORDER BY (oi.ordem IS NULL), oi.ordem ASC, oi.id ASC, oi.created_at ASC`,
      [req.params.id]
    );
    
    console.log(`[DEBUG] Organistas da igreja ${req.params.id}:`, rows.length, 'encontradas (todas as ativas)');
    
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