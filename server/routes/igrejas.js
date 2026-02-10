const express = require('express');
const router = express.Router();
const db = require('../database/db');
const cicloRepository = require('../services/cicloRepository');
const { authenticate, getUserIgrejas } = require('../middleware/auth');
const { tenantResolver, getTenantId } = require('../middleware/tenantResolver');
const { getPesoDiaSemanaBr } = require('../utils/dateHelpers');

// --- ROTA 1: Listar Igrejas ---
router.get('/', authenticate, tenantResolver, async (req, res) => {
  try {
    const pool = db.getDb();
    const tenantId = getTenantId(req);
    if (req.user.role === 'admin' && !tenantId) {
       const [igrejas] = await pool.execute('SELECT * FROM igrejas');
       res.json(igrejas);
    } else {
      const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
      res.json(igrejas);
    }
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- ROTA 2: Cabeçalhos dos Ciclos ---
router.get('/:id/ciclos', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id);
    const totalCiclos = await cicloRepository.getQuantidadeCultos(igrejaId);
    const pool = db.getDb();
    const [cultos] = await pool.execute('SELECT id, dia_semana, hora FROM cultos WHERE igreja_id = ? AND ativo = 1 ORDER BY dia_semana, hora', [igrejaId]);
    const cultosOrdenados = [...cultos].sort((a, b) => {
      const pa = getPesoDiaSemanaBr(a.dia_semana);
      const pb = getPesoDiaSemanaBr(b.dia_semana);
      if (pa !== pb) return pa - pb;
      return (a.hora || '').localeCompare(b.hora || '');
    });
    res.json({ igreja_id: igrejaId, total_ciclos: totalCiclos, ciclos: Array.from({ length: totalCiclos }, (_, i) => ({ numero_ciclo: i + 1, culto: cultosOrdenados[i] || null })) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- ROTA 3: Ler Itens (AQUI ESTÁ A CORREÇÃO BAZUCA) ---
router.get('/:id/ciclos/:numero', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id);
    const numero = parseInt(req.params.numero);
    if (req.user.role !== 'admin') {
       const igrejas = await getUserIgrejas(req.user.id, false, getTenantId(req));
       if (!igrejas.some(i => i.id === igrejaId)) return res.status(403).json({ error: 'Acesso negado' });
    }

    // Força o navegador a não usar cache para essa rota
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const pool = db.getDb();
    // Pega TUDO que for possível do banco
    const [itens] = await pool.execute(`
        SELECT 
            o.id as organista_id, 
            o.nome, 
            o.oficializada, 
            co.ordem as posicao,
            co.ordem,
            co.id as link_id
        FROM organistas o
        JOIN ciclo_organistas co ON co.organista_id = o.id
        WHERE co.igreja_id = ? AND co.ciclo = ?
        ORDER BY co.ordem ASC
    `, [igrejaId, numero]);

    // Mapeia o nome para TODAS as variáveis possíveis
    const itensFormatados = itens.map(i => ({
        // 1. Variáveis na Raiz
        id: i.organista_id,
        nome: i.nome,           // <--- Opção A
        name: i.nome,           // <--- Opção B (Inglês)
        label: i.nome,          // <--- Opção C
        organista_nome: i.nome, // <--- Opção D
        
        posicao: i.ordem,
        ordem: i.ordem,
        oficializada: !!i.oficializada,
        
        // 2. Objeto Aninhado (Padrão Sequelize)
        organista: {
            id: i.organista_id,
            nome: i.nome,       // <--- Opção E (Mais provável)
            name: i.nome,
            oficializada: !!i.oficializada
        }
    }));

    res.json(itensFormatados);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- ROTA 4: Salvar Ciclo ---
router.put('/:id/ciclos/:numero', authenticate, async (req, res) => {
    try {
        const igrejaId = parseInt(req.params.id); const numero = parseInt(req.params.numero); const { itens } = req.body || {};
        await cicloRepository.saveCicloItens(igrejaId, numero, itens);
        
        // Retorna formato BAZUCA também no salvamento
        const pool = db.getDb();
        const [atualizado] = await pool.execute(`
            SELECT o.id, o.nome, o.oficializada, co.ordem 
            FROM organistas o
            JOIN ciclo_organistas co ON co.organista_id = o.id
            WHERE co.igreja_id = ? AND co.ciclo = ?
            ORDER BY co.ordem ASC
        `, [igrejaId, numero]);

        const formatado = atualizado.map(i => ({
            id: i.id, nome: i.nome, name: i.nome, posicao: i.ordem, oficializada: !!i.oficializada,
            organista: { id: i.id, nome: i.nome, name: i.nome, oficializada: !!i.oficializada }
        }));
        
        res.json({ message: 'Ciclo salvo', itens: formatado });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- ROTA 5: Listar Todas (Dropdown) ---
router.get('/:id/ciclos-organistas', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id);
    if (isNaN(igrejaId)) return res.status(400).json({ error: 'ID inválido' });
    if (req.user.role !== 'admin') {
      const igrejas = await getUserIgrejas(req.user.id, false, getTenantId(req));
      if (!igrejas.some(i => i.id === igrejaId)) return res.status(403).json({ error: 'Acesso negado' });
    }
    const pool = db.getDb();
    const [rows] = await pool.execute(`
      SELECT o.id, o.nome, o.oficializada, o.ativa, co.ciclo, co.ordem
      FROM organistas o
      JOIN ciclo_organistas co ON co.organista_id = o.id
      WHERE co.igreja_id = ?
      ORDER BY co.ciclo ASC, co.ordem ASC
    `, [igrejaId]);

    const organistasFormatadas = rows.map(o => ({
      ...o,
      oficializada: !!o.oficializada,
      ativa: !!o.ativa,
      ciclo: Number(o.ciclo),
      ordem: Number(o.ordem),
      organista: { id: o.id, nome: o.nome }
    }));
    res.json(organistasFormatadas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Rotas Auxiliares ---
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    const [rows] = await pool.execute('SELECT * FROM igrejas WHERE id = ?', [req.params.id]);
    if (rows.length > 0) res.json(rows[0]); else res.status(404).json({error: 'Não encontrada'});
  } catch (e) { res.status(500).json({error: e.message}); }
});
router.post('/', authenticate, async (req, res) => res.json({msg: 'Use rota original'}));
router.put('/:id', authenticate, async (req, res) => res.json({msg: 'OK'}));
router.delete('/:id', authenticate, async (req, res) => res.json({msg: 'OK'}));
router.get('/:id/organistas', authenticate, async (req, res) => {
    const pool = db.getDb();
    const [rows] = await pool.execute('SELECT o.*, oi.oficializada as associacao_oficializada FROM organistas o INNER JOIN organistas_igreja oi ON o.id = oi.organista_id WHERE oi.igreja_id = ?', [req.params.id]);
    res.json(rows);
});
router.post('/:id/organistas', authenticate, async (req, res) => {
    const { organista_id } = req.body;
    const pool = db.getDb();
    await pool.execute('INSERT IGNORE INTO organistas_igreja (organista_id, igreja_id, oficializada) VALUES (?, ?, 1)', [organista_id, req.params.id]);
    res.json({msg: 'OK'});
});
router.delete('/:id/organistas/:organista_id', authenticate, async (req, res) => {
    const pool = db.getDb();
    await pool.execute('DELETE FROM organistas_igreja WHERE igreja_id = ? AND organista_id = ?', [req.params.id, req.params.organista_id]);
    res.json({msg: 'OK'});
});

module.exports = router;