const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { gerarPreviaEscala } = require('../services/rodizioCicloService');
const pdfService = require('../services/pdfService');
const { authenticate, getUserIgrejas } = require('../middleware/auth');
const { tenantResolver, getTenantId } = require('../middleware/tenantResolver');
const { checkIgrejaAccess } = require('../middleware/igrejaAccess');

/** Verifica se o usuário tem acesso à igreja da escala (por escala_id). */
async function checkEscalaAccess(req, res, next) {
  try {
    const escalaId = req.params.id;
    if (!escalaId) return res.status(400).json({ error: 'ID da escala é obrigatório' });
    const pool = db.getDb();
    const [rows] = await pool.execute('SELECT igreja_id FROM escalas WHERE id = ?', [escalaId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Escala não encontrada' });
    req.igrejaId = rows[0].igreja_id;
    const tenantId = getTenantId(req);
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    const temAcesso = req.user.role === 'admin' || igrejas.some(i => i.id === req.igrejaId);
    if (!temAcesso) return res.status(403).json({ error: 'Acesso negado a esta escala' });
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/** POST /gerar-previa — simula escala para o período; não salva nada. */
router.post('/gerar-previa', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.body;
    const igrejaId = req.igrejaId;
    if (!data_inicio || !data_fim) {
      return res.status(400).json({ error: 'data_inicio e data_fim são obrigatórios' });
    }
    const itens = await gerarPreviaEscala(igrejaId, data_inicio, data_fim);
    res.json({ itens, data_inicio, data_fim, igreja_id: igrejaId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST / — salva escala e itens (transação). */
router.post('/', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  const pool = db.getDb();
  const conn = await pool.getConnection();
  try {
    const { nome_referencia, data_inicio, data_fim, status, itens } = req.body;
    const igrejaId = req.igrejaId;
    if (!nome_referencia || !data_inicio || !data_fim) {
      return res.status(400).json({ error: 'nome_referencia, data_inicio e data_fim são obrigatórios' });
    }
    if (!Array.isArray(itens)) {
      return res.status(400).json({ error: 'itens deve ser um array' });
    }

    await conn.beginTransaction();

    const [insEscala] = await conn.execute(
      `INSERT INTO escalas (igreja_id, nome_referencia, data_inicio, data_fim, status)
       VALUES (?, ?, ?, ?, ?)`,
      [igrejaId, nome_referencia, data_inicio, data_fim, status || 'Publicada']
    );
    const escalaId = insEscala.insertId;

    for (const row of itens) {
      await conn.execute(
        `INSERT INTO escala_itens (escala_id, data, hora, culto_nome, funcao, organista_id, organista_nome, ciclo_origem)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          escalaId,
          row.data,
          row.hora || null,
          row.culto_nome || '',
          row.funcao || null,
          row.organista_id ?? null,
          row.organista_nome || '',
          row.ciclo_origem ?? 0
        ]
      );
    }

    await conn.commit();
    res.status(201).json({ id: escalaId, message: 'Escala salva com sucesso' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

/** GET / — lista escalas da igreja (?igreja_id=). */
router.get('/', authenticate, tenantResolver, async (req, res) => {
  try {
    const igrejaId = req.query.igreja_id;
    if (!igrejaId) return res.status(400).json({ error: 'igreja_id é obrigatório' });
    const tenantId = getTenantId(req);
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    const idInt = parseInt(igrejaId);
    if (req.user.role !== 'admin' && !igrejas.some(i => i.id === idInt)) {
      return res.status(403).json({ error: 'Acesso negado a esta igreja' });
    }
    const pool = db.getDb();
    const [rows] = await pool.execute(
      'SELECT id, igreja_id, nome_referencia, data_inicio, data_fim, status, created_at FROM escalas WHERE igreja_id = ? ORDER BY data_inicio DESC',
      [idInt]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /:id — detalhes da escala e itens. */
router.get('/:id', authenticate, tenantResolver, checkEscalaAccess, async (req, res) => {
  try {
    const pool = db.getDb();
    const [escalas] = await pool.execute(
      'SELECT id, igreja_id, nome_referencia, data_inicio, data_fim, status, created_at FROM escalas WHERE id = ?',
      [req.params.id]
    );
    if (escalas.length === 0) return res.status(404).json({ error: 'Escala não encontrada' });
    const [itens] = await pool.execute(
      'SELECT id, data, hora, culto_nome, funcao, organista_id, organista_nome, ciclo_origem FROM escala_itens WHERE escala_id = ? ORDER BY data, hora',
      [req.params.id]
    );
    res.json({ ...escalas[0], itens });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /:id — remove escala (cascade nos itens). */
router.delete('/:id', authenticate, tenantResolver, checkEscalaAccess, async (req, res) => {
  try {
    const pool = db.getDb();
    const [result] = await pool.execute('DELETE FROM escalas WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Escala não encontrada' });
    res.json({ message: 'Escala excluída com sucesso' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /pdf-previa — gera PDF da prévia (body: nome_referencia, data_inicio, data_fim, igreja_id, itens). */
router.post('/pdf-previa', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    const { nome_referencia, data_inicio, data_fim, itens } = req.body;
    const igrejaId = req.igrejaId;
    const pool = db.getDb();
    const [igrejas] = await pool.execute('SELECT nome FROM igrejas WHERE id = ?', [igrejaId]);
    const igrejaNome = igrejas[0]?.nome || '';
    const lista = Array.isArray(itens) ? itens : [];
    const pdfBuffer = await pdfService.gerarPDFEscala(
      { nome_referencia: nome_referencia || 'Prévia', data_inicio, data_fim, igreja_nome: igrejaNome },
      lista
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="escala-previa.pdf"');
    res.send(pdfBuffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /:id/pdf — PDF da escala (organista + Ciclo N). */
router.get('/:id/pdf', authenticate, tenantResolver, checkEscalaAccess, async (req, res) => {
  try {
    const pool = db.getDb();
    const [escalas] = await pool.execute('SELECT * FROM escalas WHERE id = ?', [req.params.id]);
    if (escalas.length === 0) return res.status(404).json({ error: 'Escala não encontrada' });
    const [itens] = await pool.execute(
      'SELECT data, hora, culto_nome, funcao, organista_nome, ciclo_origem FROM escala_itens WHERE escala_id = ? ORDER BY data, hora',
      [req.params.id]
    );
    const escala = escalas[0];
    const [igrejas] = await pool.execute('SELECT nome FROM igrejas WHERE id = ?', [escala.igreja_id]);
    const igrejaNome = igrejas[0]?.nome || '';
    const pdfBuffer = await pdfService.gerarPDFEscala({
      nome_referencia: escala.nome_referencia,
      data_inicio: escala.data_inicio,
      data_fim: escala.data_fim,
      igreja_nome: igrejaNome
    }, itens);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="escala-${escala.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
