const express = require('express');
const router = express.Router();
const db = require('../database/db');
const notificacaoService = require('../services/notificacaoService');
const { authenticate, getUserIgrejas } = require('../middleware/auth');

// Listar notificações (filtrado por igrejas do usuário)
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    const igrejaIds = igrejas.map(i => i.id);
    
    if (igrejaIds.length === 0) {
      return res.json([]);
    }
    
    const placeholders = igrejaIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT n.*, r.data_culto, o.nome as organista_nome, i.nome as igreja_nome
       FROM notificacoes n
       INNER JOIN rodizios r ON n.rodizio_id = r.id
       INNER JOIN organistas o ON r.organista_id = o.id
       INNER JOIN igrejas i ON r.igreja_id = i.id
       WHERE r.igreja_id IN (${placeholders})
       ORDER BY n.created_at DESC
       LIMIT 100`,
      igrejaIds
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar notificação manual
router.post('/enviar/:rodizio_id', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    
    const [rows] = await pool.execute(
      `SELECT r.*, 
              o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
              i.nome as igreja_nome,
              i.encarregado_local_nome, i.encarregado_local_telefone,
              i.encarregado_regional_nome, i.encarregado_regional_telefone,
              c.dia_semana, c.hora as hora_culto
       FROM rodizios r
       INNER JOIN organistas o ON r.organista_id = o.id
       INNER JOIN igrejas i ON r.igreja_id = i.id
       INNER JOIN cultos c ON r.culto_id = c.id
       WHERE r.id = ?`,
      [req.params.rodizio_id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Rodízio não encontrado' });
    }
    
    // Verificar acesso à igreja do rodízio
    if (req.user.role !== 'admin') {
      const [associations] = await pool.execute(
        'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
        [req.user.id, rows[0].igreja_id]
      );
      
      if (associations.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a este rodízio' });
      }
    }
    
    try {
      await notificacaoService.enviarNotificacaoDiaCulto(rows[0]);
      res.json({ message: 'Notificação enviada com sucesso' });
    } catch (notifError) {
      res.status(500).json({ error: notifError.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
