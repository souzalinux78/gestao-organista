const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticate, isAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// TENANTS CRUD
// ============================================

// Listar todos os tenants
router.get('/tenants', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const pool = db.getDb();
  const [tenants] = await pool.execute(`
    SELECT 
      t.*,
      COUNT(DISTINCT u.id) as total_usuarios,
      COUNT(DISTINCT i.id) as total_igrejas,
      COUNT(DISTINCT o.id) as total_organistas
    FROM tenants t
    LEFT JOIN usuarios u ON u.tenant_id = t.id
    LEFT JOIN igrejas i ON i.tenant_id = t.id
    LEFT JOIN organistas o ON o.tenant_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `);
  
  res.json(tenants);
}));

// Obter tenant por ID
router.get('/tenants/:id', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const pool = db.getDb();
  const [tenants] = await pool.execute(
    'SELECT * FROM tenants WHERE id = ?',
    [req.params.id]
  );
  
  if (tenants.length === 0) {
    return res.status(404).json({ error: 'Tenant não encontrado' });
  }
  
  res.json(tenants[0]);
}));

// Criar tenant
router.post('/tenants', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { nome, slug, ativo = true } = req.body;
  
  if (!nome || !slug) {
    return res.status(400).json({ error: 'Nome e slug são obrigatórios' });
  }
  
  // Validar slug (apenas letras, números e hífens)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Slug inválido. Use apenas letras minúsculas, números e hífens' });
  }
  
  const pool = db.getDb();
  
  // Verificar se slug já existe
  const [existing] = await pool.execute(
    'SELECT id FROM tenants WHERE slug = ?',
    [slug]
  );
  
  if (existing.length > 0) {
    return res.status(400).json({ error: 'Slug já existe' });
  }
  
  const [result] = await pool.execute(
    'INSERT INTO tenants (nome, slug, ativo) VALUES (?, ?, ?)',
    [nome, slug, ativo ? 1 : 0]
  );
  
  logger.info('Tenant criado', { tenantId: result.insertId, nome, slug });
  
  res.status(201).json({
    id: result.insertId,
    nome,
    slug,
    ativo: ativo ? 1 : 0,
    message: 'Tenant criado com sucesso'
  });
}));

// Atualizar tenant
router.put('/tenants/:id', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { nome, slug, ativo } = req.body;
  const pool = db.getDb();
  
  // Verificar se tenant existe
  const [existing] = await pool.execute(
    'SELECT id FROM tenants WHERE id = ?',
    [req.params.id]
  );
  
  if (existing.length === 0) {
    return res.status(404).json({ error: 'Tenant não encontrado' });
  }
  
  const updates = [];
  const values = [];
  
  if (nome !== undefined) {
    updates.push('nome = ?');
    values.push(nome);
  }
  
  if (slug !== undefined) {
    // Validar slug
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: 'Slug inválido. Use apenas letras minúsculas, números e hífens' });
    }
    
    // Verificar se slug já existe em outro tenant
    const [slugExists] = await pool.execute(
      'SELECT id FROM tenants WHERE slug = ? AND id != ?',
      [slug, req.params.id]
    );
    
    if (slugExists.length > 0) {
      return res.status(400).json({ error: 'Slug já existe' });
    }
    
    updates.push('slug = ?');
    values.push(slug);
  }
  
  if (ativo !== undefined) {
    updates.push('ativo = ?');
    values.push(ativo ? 1 : 0);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  }
  
  values.push(req.params.id);
  
  await pool.execute(
    `UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  logger.info('Tenant atualizado', { tenantId: req.params.id });
  
  res.json({ message: 'Tenant atualizado com sucesso' });
}));

// Deletar tenant
router.delete('/tenants/:id', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const pool = db.getDb();
  
  // Verificar se tenant existe
  const [existing] = await pool.execute(
    'SELECT id, slug FROM tenants WHERE id = ?',
    [req.params.id]
  );
  
  if (existing.length === 0) {
    return res.status(404).json({ error: 'Tenant não encontrado' });
  }
  
  // Não permitir deletar tenant padrão
  if (existing[0].slug === 'default') {
    return res.status(400).json({ error: 'Não é possível deletar o tenant padrão' });
  }
  
  // Verificar se há usuários, igrejas ou organistas associados
  const [users] = await pool.execute(
    'SELECT COUNT(*) as count FROM usuarios WHERE tenant_id = ?',
    [req.params.id]
  );
  
  const [igrejas] = await pool.execute(
    'SELECT COUNT(*) as count FROM igrejas WHERE tenant_id = ?',
    [req.params.id]
  );
  
  const [organistas] = await pool.execute(
    'SELECT COUNT(*) as count FROM organistas WHERE tenant_id = ?',
    [req.params.id]
  );
  
  if (users[0].count > 0 || igrejas[0].count > 0 || organistas[0].count > 0) {
    return res.status(400).json({ 
      error: 'Não é possível deletar tenant com dados associados. Primeiro migre os dados para outro tenant.' 
    });
  }
  
  await pool.execute('DELETE FROM tenants WHERE id = ?', [req.params.id]);
  
  logger.info('Tenant deletado', { tenantId: req.params.id });
  
  res.json({ message: 'Tenant deletado com sucesso' });
}));

// ============================================
// RESET SENHA
// ============================================

// Resetar senha de usuário
router.post('/usuarios/:id/reset-password', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { nova_senha } = req.body;
  
  if (!nova_senha || nova_senha.length < 6) {
    return res.status(400).json({ error: 'Nova senha deve ter no mínimo 6 caracteres' });
  }
  
  const pool = db.getDb();
  
  // Verificar se usuário existe
  const [users] = await pool.execute(
    'SELECT id, email FROM usuarios WHERE id = ?',
    [req.params.id]
  );
  
  if (users.length === 0) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }
  
  // Hash da nova senha
  const senhaHash = await bcrypt.hash(nova_senha, 10);
  
  // Atualizar senha
  await pool.execute(
    'UPDATE usuarios SET senha_hash = ? WHERE id = ?',
    [senhaHash, req.params.id]
  );
  
  logger.info('Senha resetada pelo admin', { 
    userId: req.params.id, 
    email: users[0].email,
    adminId: req.user.id 
  });
  
  res.json({ message: 'Senha resetada com sucesso' });
}));

// ============================================
// MÉTRICAS
// ============================================

// Obter métricas do sistema
router.get('/metrics', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const pool = db.getDb();
  
  // Total de usuários
  const [totalUsuarios] = await pool.execute('SELECT COUNT(*) as total FROM usuarios');
  
  // Usuários por role
  const [usuariosPorRole] = await pool.execute(`
    SELECT role, COUNT(*) as total 
    FROM usuarios 
    GROUP BY role
  `);
  
  // Usuários aprovados vs pendentes
  const [usuariosAprovacao] = await pool.execute(`
    SELECT 
      SUM(CASE WHEN aprovado = 1 THEN 1 ELSE 0 END) as aprovados,
      SUM(CASE WHEN aprovado = 0 THEN 1 ELSE 0 END) as pendentes
    FROM usuarios
  `);
  
  // Total de igrejas
  const [totalIgrejas] = await pool.execute('SELECT COUNT(*) as total FROM igrejas');
  
  // Total de organistas
  const [totalOrganistas] = await pool.execute('SELECT COUNT(*) as total FROM organistas');
  
  // Total de rodízios
  const [totalRodizios] = await pool.execute('SELECT COUNT(*) as total FROM rodizios');
  
  // Total de tenants
  const [totalTenants] = await pool.execute('SELECT COUNT(*) as total FROM tenants');
  
  // Usuários por tenant
  const [usuariosPorTenant] = await pool.execute(`
    SELECT 
      t.id,
      t.nome,
      t.slug,
      COUNT(u.id) as total_usuarios
    FROM tenants t
    LEFT JOIN usuarios u ON u.tenant_id = t.id
    GROUP BY t.id
    ORDER BY total_usuarios DESC
  `);
  
  // Rodízios por mês (últimos 6 meses)
  const [rodiziosPorMes] = await pool.execute(`
    SELECT 
      DATE_FORMAT(data_culto, '%Y-%m') as mes,
      COUNT(*) as total
    FROM rodizios
    WHERE data_culto >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY mes
    ORDER BY mes DESC
  `);
  
  res.json({
    usuarios: {
      total: totalUsuarios[0].total,
      por_role: usuariosPorRole,
      aprovacao: usuariosAprovacao[0]
    },
    igrejas: {
      total: totalIgrejas[0].total
    },
    organistas: {
      total: totalOrganistas[0].total
    },
    rodizios: {
      total: totalRodizios[0].total,
      por_mes: rodiziosPorMes
    },
    tenants: {
      total: totalTenants[0].total,
      usuarios_por_tenant: usuariosPorTenant
    }
  });
}));

// ============================================
// LOGS
// ============================================

// Obter logs do sistema
router.get('/logs', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { nivel, limit = 100, offset = 0 } = req.query;
  const pool = db.getDb();
  
  let query = 'SELECT * FROM logs WHERE 1=1';
  const params = [];
  
  if (nivel) {
    query += ' AND nivel = ?';
    params.push(nivel);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const [logs] = await pool.execute(query, params);
  
  // Total de logs
  let countQuery = 'SELECT COUNT(*) as total FROM logs WHERE 1=1';
  const countParams = [];
  
  if (nivel) {
    countQuery += ' AND nivel = ?';
    countParams.push(nivel);
  }
  
  const [total] = await pool.execute(countQuery, countParams);
  
  res.json({
    logs,
    total: total[0].total,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

// Limpar logs antigos
router.delete('/logs', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { dias = 30 } = req.query;
  const pool = db.getDb();
  
  await pool.execute(
    'DELETE FROM logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
    [dias]
  );
  
  logger.info('Logs antigos limpos', { dias, adminId: req.user.id });
  
  res.json({ message: `Logs anteriores a ${dias} dias foram removidos` });
}));

module.exports = router;
