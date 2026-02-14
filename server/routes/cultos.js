const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, getUserIgrejas } = require('../middleware/auth');
const { tenantResolver, getTenantId } = require('../middleware/tenantResolver');
const { getPesoDiaSemanaBr } = require('../utils/dateHelpers');

// Listar cultos (filtrado por igrejas do usuário e tenant)
router.get('/', authenticate, tenantResolver, async (req, res) => {
  try {
    const pool = db.getDb();
    const tenantId = getTenantId(req);
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    const igrejaIds = igrejas.map(i => i.id);

    if (igrejaIds.length === 0) {
      return res.json([]);
    }

    const placeholders = igrejaIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT c.*, i.nome as igreja_nome 
       FROM cultos c
       INNER JOIN igrejas i ON c.igreja_id = i.id
       WHERE c.igreja_id IN (${placeholders})`,
      igrejaIds
    );
    rows.sort((a, b) => {
      if (a.igreja_nome !== b.igreja_nome) return (a.igreja_nome || '').localeCompare(b.igreja_nome || '');
      const pa = getPesoDiaSemanaBr(a.dia_semana);
      const pb = getPesoDiaSemanaBr(b.dia_semana);
      if (pa !== pb) return pa - pb;
      return (a.hora || '').localeCompare(b.hora || '');
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar cultos de uma igreja (com verificação de acesso)
router.get('/igreja/:igreja_id', authenticate, async (req, res) => {
  try {
    // Verificar acesso à igreja
    if (req.user.role !== 'admin') {
      const pool = db.getDb();
      const [associations] = await pool.execute(
        'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
        [req.user.id, req.params.igreja_id]
      );

      if (associations.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta igreja' });
      }
    }

    const pool = db.getDb();
    const [rows] = await pool.execute(
      `SELECT c.*, 
              cc.ciclo_id
       FROM cultos c
       LEFT JOIN ciclos_cultos cc ON c.id = cc.culto_id
       WHERE c.igreja_id = ? AND c.ativo = 1`,
      [req.params.igreja_id]
    );
    rows.sort((a, b) => {
      const pa = getPesoDiaSemanaBr(a.dia_semana);
      const pb = getPesoDiaSemanaBr(b.dia_semana);
      if (pa !== pb) return pa - pb;
      return (a.hora || '').localeCompare(b.hora || '');
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar culto por ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    const [rows] = await pool.execute(
      `SELECT c.*, i.nome as igreja_nome 
       FROM cultos c
       INNER JOIN igrejas i ON c.igreja_id = i.id
       WHERE c.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Culto não encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar novo culto (com verificação de acesso à igreja)
router.post('/', authenticate, async (req, res) => {
  try {
    const { igreja_id, dia_semana, hora, ativo, permite_alunas } = req.body;

    // Verificar acesso à igreja
    if (req.user.role !== 'admin') {
      const pool = db.getDb();
      const [associations] = await pool.execute(
        'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
        [req.user.id, igreja_id]
      );

      if (associations.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a esta igreja' });
      }
    }

    const pool = db.getDb();

    const permiteAlunasVal = permite_alunas !== undefined ? (permite_alunas ? 1 : 0) : 1;
    const tipoVal = req.body.tipo || 'culto_oficial';

    const [result] = await pool.execute(
      'INSERT INTO cultos (igreja_id, dia_semana, hora, ativo, permite_alunas, tipo) VALUES (?, ?, ?, ?, ?, ?)',
      [igreja_id, dia_semana, hora, ativo !== undefined ? (ativo ? 1 : 0) : 1, permiteAlunasVal, tipoVal]
    );

    res.json({
      id: result.insertId,
      igreja_id,
      dia_semana,
      hora,
      ativo,
      permite_alunas: permiteAlunasVal,
      tipo: tipoVal
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar culto (com verificação de acesso)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { dia_semana, hora, ativo, permite_alunas } = req.body;
    const pool = db.getDb();

    // Verificar acesso ao culto (através da igreja)
    if (req.user.role !== 'admin') {
      const [cultos] = await pool.execute('SELECT igreja_id FROM cultos WHERE id = ?', [req.params.id]);
      if (cultos.length > 0) {
        const [associations] = await pool.execute(
          'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
          [req.user.id, cultos[0].igreja_id]
        );

        if (associations.length === 0) {
          return res.status(403).json({ error: 'Acesso negado a este culto' });
        }
      }
    }

    const permiteAlunasVal = permite_alunas !== undefined ? (permite_alunas ? 1 : 0) : 1;
    const tipoVal = req.body.tipo || 'culto_oficial';
    const [result] = await pool.execute(
      'UPDATE cultos SET dia_semana = ?, hora = ?, ativo = ?, permite_alunas = ?, tipo = ? WHERE id = ?',
      [dia_semana, hora, ativo ? 1 : 0, permiteAlunasVal, tipoVal, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Culto não encontrado' });
    }

    res.json({
      id: req.params.id,
      dia_semana,
      hora,
      ativo,
      permite_alunas: permiteAlunasVal,
      tipo: tipoVal
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar culto (com verificação de acesso)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();

    // Verificar acesso ao culto (através da igreja)
    if (req.user.role !== 'admin') {
      const [cultos] = await pool.execute('SELECT igreja_id FROM cultos WHERE id = ?', [req.params.id]);
      if (cultos.length > 0) {
        const [associations] = await pool.execute(
          'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
          [req.user.id, cultos[0].igreja_id]
        );

        if (associations.length === 0) {
          return res.status(403).json({ error: 'Acesso negado a este culto' });
        }
      }
    }

    const [result] = await pool.execute('DELETE FROM cultos WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Culto não encontrado' });
    }

    res.json({ message: 'Culto deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
