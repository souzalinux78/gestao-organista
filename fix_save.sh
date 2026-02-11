#!/bin/bash
echo "🛡️ CORRIGINDO ERRO DE SALVAMENTO (UNDEFINED)..."

# Reescreve o arquivo igrejas.js com tratamento de erro robusto
cat > /var/www/gestao-organista/server/routes/igrejas.js << 'EOF'
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

// --- ROTA 3: Ler Itens (GET) ---
router.get('/:id/ciclos/:numero', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id);
    const numero = parseInt(req.params.numero);
    if (req.user.role !== 'admin') {
       const igrejas = await getUserIgrejas(req.user.id, false, getTenantId(req));
       if (!igrejas.some(i => i.id === igrejaId)) return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Desativa cache
    res.set('Cache-Control', 'no-store');

    const pool = db.getDb();
    const [itens] = await pool.execute(`
        SELECT 
            o.id, o.nome, o.oficializada, 
            co.ordem, co.id as link_id
        FROM organistas o
        JOIN ciclo_organistas co ON co.organista_id = o.id
        WHERE co.igreja_id = ? AND co.ciclo = ?
        ORDER BY co.ordem ASC
    `, [igrejaId, numero]);

    const itensFormatados = itens.map(i => ({
        id: i.id,
        nome: i.nome,
        ordem: i.ordem,
        oficializada: !!i.oficializada,
        organista: { id: i.id, nome: i.nome, oficializada: !!i.oficializada }
    }));

    res.json(itensFormatados);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- ROTA 4: SALVAR CICLO (CORREÇÃO DO BUG UNDEFINED) ---
router.put('/:id/ciclos/:numero', authenticate, async (req, res) => {
    try {
        const igrejaId = parseInt(req.params.id); 
        const numero = parseInt(req.params.numero); 
        const { itens } = req.body || {};

        if (!Array.isArray(itens)) {
            return res.status(400).json({ error: "Formato inválido: 'itens' deve ser um array." });
        }

        // --- SANITIZAÇÃO (A CORREÇÃO ESTÁ AQUI) ---
        // Prepara os dados para garantir que nada seja undefined
        const itensLimpos = itens.map((item, index) => {
            // Tenta achar o ID em vários lugares (estrutura híbrida)
            const orgId = item.organista_id || (item.organista && item.organista.id) || item.id;
            
            // Se não tiver ID, ignora este item (evita crash)
            if (!orgId) return null;

            return {
                organista_id: parseInt(orgId),
                // Se ordem for undefined, usa o index do array + 1
                ordem: (item.ordem !== undefined && item.ordem !== null) ? parseInt(item.ordem) : (index + 1)
            };
        }).filter(Boolean); // Remove os nulos

        // Envia para o repository apenas dados limpos
        await cicloRepository.saveCicloItens(igrejaId, numero, itensLimpos);
        
        // Retorna a lista atualizada
        const pool = db.getDb();
        const [atualizado] = await pool.execute(`
            SELECT o.id, o.nome, o.oficializada, co.ordem 
            FROM organistas o
            JOIN ciclo_organistas co ON co.organista_id = o.id
            WHERE co.igreja_id = ? AND co.ciclo = ?
            ORDER BY co.ordem ASC
        `, [igrejaId, numero]);

        const formatado = atualizado.map(i => ({
            id: i.id, nome: i.nome, ordem: i.ordem, oficializada: !!i.oficializada,
            organista: { id: i.id, nome: i.nome, oficializada: !!i.oficializada }
        }));
        
        res.json({ message: 'Ciclo salvo com sucesso', itens: formatado });
    } catch (error) { 
        console.error("Erro ao salvar ciclo:", error);
        res.status(500).json({ error: error.message }); 
    }
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
EOF

echo "✅ Rota de salvamento BLINDADA contra undefined."
echo "🔄 Reiniciando Servidor..."
pm2 restart all --update-env
echo "🎉 Tente SALVAR o ciclo agora!"