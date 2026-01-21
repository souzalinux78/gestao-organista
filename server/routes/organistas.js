const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, getUserIgrejas } = require('../middleware/auth');

// Listar organistas (filtrado por igrejas do usuário)
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    
    // Obter igrejas do usuário
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    const igrejaIds = igrejas.map(i => i.id);
    
    if (igrejaIds.length === 0) {
      return res.json([]);
    }
    
    // Buscar organistas associadas às igrejas do usuário
    const [rows] = await pool.execute(
      `SELECT DISTINCT o.* 
       FROM organistas o
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
       WHERE oi.igreja_id IN (${igrejaIds.map(() => '?').join(',')})
       ORDER BY (o.ordem IS NULL), o.ordem ASC, o.nome ASC`,
      igrejaIds
    );
    
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar organista por ID (com verificação de acesso)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    
    // Obter igrejas do usuário
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    const igrejaIds = igrejas.map(i => i.id);
    
    // Verificar se a organista está associada a alguma igreja do usuário
    const [rows] = await pool.execute(
      `SELECT o.* 
       FROM organistas o
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
       WHERE o.id = ? AND oi.igreja_id IN (${igrejaIds.length > 0 ? igrejaIds.map(() => '?').join(',') : 'NULL'})`,
      igrejaIds.length > 0 ? [req.params.id, ...igrejaIds] : [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Organista não encontrada ou acesso negado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar nova organista
router.post('/', authenticate, async (req, res) => {
  try {
    const { nome, telefone, email, oficializada, ativa, ordem } = req.body;
    const pool = db.getDb();
    
    const [result] = await pool.execute(
      'INSERT INTO organistas (ordem, nome, telefone, email, oficializada, ativa) VALUES (?, ?, ?, ?, ?, ?)',
      [
        ordem !== undefined && ordem !== '' ? Number(ordem) : null,
        nome,
        telefone || null,
        email || null,
        oficializada ? 1 : 0,
        ativa !== undefined ? (ativa ? 1 : 0) : 1
      ]
    );
    
    res.json({ 
      id: result.insertId, 
      ordem: ordem !== undefined && ordem !== '' ? Number(ordem) : null,
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

// Atualizar organista (com verificação de acesso)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { nome, telefone, email, oficializada, ativa, ordem } = req.body;
    const pool = db.getDb();
    
    // Obter igrejas do usuário
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    const igrejaIds = igrejas.map(i => i.id);
    
    // Verificar se a organista está associada a alguma igreja do usuário
    if (igrejaIds.length > 0) {
      const [check] = await pool.execute(
        `SELECT o.id 
         FROM organistas o
         INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
         WHERE o.id = ? AND oi.igreja_id IN (${igrejaIds.map(() => '?').join(',')})
         LIMIT 1`,
        [req.params.id, ...igrejaIds]
      );
      
      if (check.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta organista' });
      }
    } else {
      return res.status(403).json({ error: 'Você não tem acesso a nenhuma igreja' });
    }
    
    const [result] = await pool.execute(
      'UPDATE organistas SET ordem = ?, nome = ?, telefone = ?, email = ?, oficializada = ?, ativa = ? WHERE id = ?',
      [
        ordem !== undefined && ordem !== '' ? Number(ordem) : null,
        nome,
        telefone || null,
        email || null,
        oficializada ? 1 : 0,
        ativa ? 1 : 0,
        req.params.id
      ]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Organista não encontrada' });
    }
    
    res.json({ 
      id: req.params.id, 
      ordem: ordem !== undefined && ordem !== '' ? Number(ordem) : null,
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
