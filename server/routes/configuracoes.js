const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, isAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Obter configuração por chave
router.get('/:chave', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { chave } = req.params;
  const pool = db.getDb();
  
  const [rows] = await pool.execute(
    'SELECT chave, valor, descricao FROM configuracoes WHERE chave = ?',
    [chave]
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Configuração não encontrada' });
  }
  
  res.json(rows[0]);
}));

// Obter todas as configurações
router.get('/', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const pool = db.getDb();
  
  const [rows] = await pool.execute(
    'SELECT chave, valor, descricao, updated_at FROM configuracoes ORDER BY chave'
  );
  
  res.json(rows);
}));

// Salvar ou atualizar configuração
router.post('/', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { chave, valor, descricao } = req.body;
  
  if (!chave) {
    return res.status(400).json({ error: 'Chave é obrigatória' });
  }
  
  const pool = db.getDb();
  
  // Verificar se já existe
  const [existing] = await pool.execute(
    'SELECT id FROM configuracoes WHERE chave = ?',
    [chave]
  );
  
  if (existing.length > 0) {
    // Atualizar
    await pool.execute(
      'UPDATE configuracoes SET valor = ?, descricao = ? WHERE chave = ?',
      [valor || null, descricao || null, chave]
    );
    logger.info(`Configuração atualizada: ${chave}`, { usuario_id: req.user.id });
  } else {
    // Criar
    await pool.execute(
      'INSERT INTO configuracoes (chave, valor, descricao) VALUES (?, ?, ?)',
      [chave, valor || null, descricao || null]
    );
    logger.info(`Configuração criada: ${chave}`, { usuario_id: req.user.id });
  }
  
  res.json({ 
    message: 'Configuração salva com sucesso',
    chave,
    valor,
    descricao
  });
}));

// Deletar configuração
router.delete('/:chave', authenticate, isAdmin, asyncHandler(async (req, res) => {
  const { chave } = req.params;
  const pool = db.getDb();
  
  const [result] = await pool.execute(
    'DELETE FROM configuracoes WHERE chave = ?',
    [chave]
  );
  
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Configuração não encontrada' });
  }
  
  logger.info(`Configuração deletada: ${chave}`, { usuario_id: req.user.id });
  res.json({ message: 'Configuração deletada com sucesso' });
}));

module.exports = router;
