const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

// Listar todas as organistas (filtrado por igrejas do usuário)
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    const [rows] = await pool.execute('SELECT * FROM organistas ORDER BY nome');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar organista por ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    const [rows] = await pool.execute('SELECT * FROM organistas WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Organista não encontrada' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar nova organista
router.post('/', authenticate, async (req, res) => {
  try {
    const { nome, telefone, email, oficializada, ativa } = req.body;
    const pool = db.getDb();
    
    const [result] = await pool.execute(
      'INSERT INTO organistas (nome, telefone, email, oficializada, ativa) VALUES (?, ?, ?, ?, ?)',
      [nome, telefone || null, email || null, oficializada ? 1 : 0, ativa !== undefined ? (ativa ? 1 : 0) : 1]
    );
    
    res.json({ 
      id: result.insertId, 
      nome, 
      telefone, 
      email, 
      oficializada, 
      ativa 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar organista
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { nome, telefone, email, oficializada, ativa } = req.body;
    const pool = db.getDb();
    
    const [result] = await pool.execute(
      'UPDATE organistas SET nome = ?, telefone = ?, email = ?, oficializada = ?, ativa = ? WHERE id = ?',
      [nome, telefone || null, email || null, oficializada ? 1 : 0, ativa ? 1 : 0, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Organista não encontrada' });
    }
    
    res.json({ 
      id: req.params.id, 
      nome, 
      telefone, 
      email, 
      oficializada, 
      ativa 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar organista
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    const [result] = await pool.execute('DELETE FROM organistas WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Organista não encontrada' });
    }
    
    res.json({ message: 'Organista deletada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
