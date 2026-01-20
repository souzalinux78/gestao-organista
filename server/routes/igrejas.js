const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, getUserIgrejas } = require('../middleware/auth');

// Listar igrejas (filtrado por usuário)
router.get('/', authenticate, async (req, res) => {
  try {
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    res.json(igrejas);
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

// Criar nova igreja (apenas admin)
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem criar igrejas' });
    }
    
    const { 
      nome, 
      endereco, 
      encarregado_local_nome, 
      encarregado_local_telefone,
      encarregado_regional_nome,
      encarregado_regional_telefone
    } = req.body;
    const pool = db.getDb();
    
    const [result] = await pool.execute(
      `INSERT INTO igrejas (
        nome, endereco, 
        encarregado_local_nome, encarregado_local_telefone,
        encarregado_regional_nome, encarregado_regional_telefone
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nome, 
        endereco || null,
        encarregado_local_nome || null,
        encarregado_local_telefone || null,
        encarregado_regional_nome || null,
        encarregado_regional_telefone || null
      ]
    );
    
    res.json({ 
      id: result.insertId, 
      nome, 
      endereco,
      encarregado_local_nome,
      encarregado_local_telefone,
      encarregado_regional_nome,
      encarregado_regional_telefone
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar igreja (apenas admin ou usuário da igreja)
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Admin pode atualizar qualquer igreja
    if (req.user.role !== 'admin') {
      // Usuário comum só pode atualizar suas igrejas
      const pool = db.getDb();
      const [associations] = await pool.execute(
        'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
        [req.user.id, req.params.id]
      );
      
      if (associations.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta igreja' });
      }
    }
    
    const { 
      nome, 
      endereco, 
      encarregado_local_nome, 
      encarregado_local_telefone,
      encarregado_regional_nome,
      encarregado_regional_telefone
    } = req.body;
    const pool = db.getDb();
    
    const [result] = await pool.execute(
      `UPDATE igrejas SET 
        nome = ?, endereco = ?,
        encarregado_local_nome = ?, encarregado_local_telefone = ?,
        encarregado_regional_nome = ?, encarregado_regional_telefone = ?
      WHERE id = ?`,
      [
        nome, 
        endereco || null,
        encarregado_local_nome || null,
        encarregado_local_telefone || null,
        encarregado_regional_nome || null,
        encarregado_regional_telefone || null,
        req.params.id
      ]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Igreja não encontrada' });
    }
    
    res.json({ 
      id: req.params.id, 
      nome, 
      endereco,
      encarregado_local_nome,
      encarregado_local_telefone,
      encarregado_regional_nome,
      encarregado_regional_telefone
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar igreja (apenas admin)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem deletar igrejas' });
    }
    
    const pool = db.getDb();
    const [result] = await pool.execute('DELETE FROM igrejas WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Igreja não encontrada' });
    }
    
    res.json({ message: 'Igreja deletada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
       ORDER BY o.nome`,
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
