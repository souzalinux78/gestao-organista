const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

// Rota de diagnóstico para verificar associações
router.get('/igreja/:igreja_id', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    const igrejaId = req.params.igreja_id;
    
    // Buscar todas as organistas oficializadas
    const [organistasOficializadas] = await pool.execute(
      'SELECT * FROM organistas WHERE oficializada = 1 AND ativa = 1'
    );
    
    // Buscar associações da igreja
    const [associacoes] = await pool.execute(
      `SELECT oi.*, o.nome as organista_nome, o.oficializada, o.ativa
       FROM organistas_igreja oi
       LEFT JOIN organistas o ON oi.organista_id = o.id
       WHERE oi.igreja_id = ?`,
      [igrejaId]
    );
    
    // Buscar organistas que deveriam aparecer no rodízio
    const [organistasRodizio] = await pool.execute(
      `SELECT o.* FROM organistas o
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
       WHERE oi.igreja_id = ? 
         AND oi.oficializada = 1 
         AND o.oficializada = 1 
         AND o.ativa = 1`,
      [igrejaId]
    );
    
    res.json({
      igreja_id: igrejaId,
      organistas_oficializadas_sistema: organistasOficializadas.length,
      organistas_oficializadas: organistasOficializadas.map(o => ({
        id: o.id,
        nome: o.nome,
        oficializada: o.oficializada,
        ativa: o.ativa
      })),
      associacoes_igreja: associacoes.length,
      associacoes: associacoes.map(a => ({
        id: a.id,
        organista_id: a.organista_id,
        organista_nome: a.organista_nome,
        associacao_oficializada: a.oficializada,
        organista_oficializada: a.oficializada,
        organista_ativa: a.ativa
      })),
      organistas_para_rodizio: organistasRodizio.length,
      organistas_rodizio: organistasRodizio.map(o => ({
        id: o.id,
        nome: o.nome
      })),
      problema: organistasRodizio.length === 0 
        ? (associacoes.length === 0 
          ? 'Nenhuma organista associada à igreja' 
          : 'Organistas associadas mas não estão oficializadas/ativas')
        : 'OK'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
