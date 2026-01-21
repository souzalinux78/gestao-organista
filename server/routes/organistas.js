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
    const dbTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 10000);
    
    // Validar nome obrigatório
    if (!nome || nome.trim() === '') {
      return res.status(400).json({ error: 'O nome da organista é obrigatório' });
    }
    
    // Obter igrejas do usuário
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    const igrejaIds = igrejas.map(i => i.id);
    
    // Criar organista (permitir mesmo sem igrejas - será associada quando criar igreja)
    const [result] = await pool.execute({
      sql: 'INSERT INTO organistas (ordem, nome, telefone, email, oficializada, ativa) VALUES (?, ?, ?, ?, ?, ?)',
      values: [
        ordem !== undefined && ordem !== '' ? Number(ordem) : null,
        nome.trim(),
        telefone || null,
        email || null,
        oficializada ? 1 : 0,
        ativa !== undefined ? (ativa ? 1 : 0) : 1
      ],
      timeout: dbTimeout
    });
    
    const organistaId = result.insertId;
    
    // Associar organista automaticamente às igrejas do usuário (se tiver igrejas)
    // Se não tiver igrejas, a organista será criada mas não associada ainda
    // Quando o usuário criar uma igreja, poderá associar manualmente ou podemos criar lógica para associar automaticamente
    if (igrejaIds.length > 0) {
      const oficializadaInt = oficializada ? 1 : 0;
      const placeholders = igrejaIds.map(() => '(?, ?, ?)').join(', ');
      const params = igrejaIds.flatMap((igrejaId) => [organistaId, igrejaId, oficializadaInt]);

      await pool.execute(
        {
          sql: `INSERT IGNORE INTO organistas_igreja (organista_id, igreja_id, oficializada) VALUES ${placeholders}`,
          values: params,
          timeout: dbTimeout
        }
      );
    }
    
    res.json({ 
      id: organistaId, 
      ordem: ordem !== undefined && ordem !== '' ? Number(ordem) : null,
      nome: nome.trim(), 
      telefone, 
      email, 
      oficializada, 
      ativa 
    });
  } catch (error) {
    console.error('[DEBUG] Erro ao criar organista:', error);
    
    // Se o MySQL travar/demorar demais, evitar 504 do proxy e responder com erro claro
    if (error.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ error: 'Banco de dados demorou para responder. Tente novamente em instantes.' });
    }

    // Tratar erro de ordem duplicada
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('unique_organistas_ordem')) {
      return res.status(400).json({ 
        error: `Já existe uma organista com a ordem ${ordem}. Escolha outra ordem ou deixe em branco.` 
      });
    }
    
    // Tratar outros erros de constraint
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        error: 'Já existe uma organista com esses dados. Verifique os campos únicos.' 
      });
    }
    
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
