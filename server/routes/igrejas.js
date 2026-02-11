const express = require('express');
const router = express.Router();
const db = require('../database/db');
// Importando o Repository que grava na tabela CERTA (ciclo_itens)
const cicloRepository = require('../services/cicloRepository');
const { authenticate, getUserIgrejas } = require('../middleware/auth');
const { tenantResolver, getTenantId } = require('../middleware/tenantResolver');
const { getPesoDiaSemanaBr } = require('../utils/dateHelpers');

console.log(">>> SISTEMA DE CICLOS V4.0 (FIXADO ciclo_itens) INICIADO <<<");

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
    const igrejaId = parseInt(req.params.id) || 0;
    const pool = db.getDb();
    
    const [rows] = await pool.execute('SELECT COUNT(*) as total FROM cultos WHERE igreja_id = ? AND ativo = 1', [igrejaId]);
    const totalCiclos = rows[0]?.total || 1;

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

// --- ROTA 3: Ler Itens (CORRIGIDO PARA ciclo_itens) ---
router.get('/:id/ciclos/:numero', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id) || 0;
    const numero = parseInt(req.params.numero) || 0;
    
    res.set('Cache-Control', 'no-store');

    // Usa o repository para garantir consistência
    const itens = await cicloRepository.getCicloItens(igrejaId, numero);

    const itensFormatados = itens.map(i => ({
        id: i.organista_id || i.id, // Fallback ID
        nome: i.organista_nome,
        ordem: i.posicao,
        oficializada: !!i.oficializada,
        organista: { id: i.organista_id, nome: i.organista_nome, oficializada: !!i.oficializada }
    }));

    res.json(itensFormatados);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- ROTA 4: SALVAR CICLO (AGORA USA O REPOSITORY CORRETO) ---
router.put('/:id/ciclos/:numero', authenticate, async (req, res) => {
    console.log(`>>> ROTA SALVAR: Ciclo ${req.params.numero} da Igreja ${req.params.id}`);

    try {
        const igrejaId = parseInt(req.params.id) || 0; 
        const numero = parseInt(req.params.numero) || 0; 
        const { itens } = req.body || {};

        if (!Array.isArray(itens)) {
            return res.status(400).json({ error: "Dados inválidos: 'itens' deve ser um array." });
        }

        // AQUI ESTAVA O ERRO: Antes fazia SQL direto na tabela errada.
        // AGORA: Chama a função salvarCiclo do repository que grava em ciclo_itens
        await cicloRepository.salvarCiclo(igrejaId, numero, itens);
        
        // Retorna os dados atualizados para confirmar visualmente
        const atualizado = await cicloRepository.getCicloItens(igrejaId, numero);
        
        const formatado = atualizado.map(i => ({
            id: i.organista_id, 
            nome: i.organista_nome, 
            ordem: i.posicao, 
            oficializada: !!i.oficializada,
            organista: { id: i.organista_id, nome: i.organista_nome, oficializada: !!i.oficializada }
        }));
        
        console.log(">>> SALVAMENTO CONCLUÍDO (Tabela ciclo_itens)");
        res.json({ message: 'Salvo com sucesso!', itens: formatado });

    } catch (error) { 
        console.error(">>> ERRO FATAL NO SALVAMENTO:", error);
        res.status(500).json({ error: "Erro interno: " + error.message }); 
    }
});

// --- ROTA 5: Listar Todas (Dropdown) - USANDO ciclo_itens ---
router.get('/:id/ciclos-organistas', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id) || 0;
    
    // Busca a "Fila Mestra" do repository, que já olha para ciclo_itens
    const rows = await cicloRepository.getFilaMestra(igrejaId);

    const organistasFormatadas = rows.map(o => ({
      ...o,
      oficializada: !!o.oficializada,
      ativa: !!o.ativa,
      ciclo: Number(o.numero_ciclo),
      ordem: Number(o.posicao || o.ordem), // Compatibilidade
      organista: { id: o.id, nome: o.nome }
    }));
    res.json(organistasFormatadas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Rotas auxiliares básicas
router.get('/:id', authenticate, async (req, res) => res.json({id: req.params.id})); 
router.post('/', authenticate, async (req, res) => res.json({msg: 'OK'}));
router.put('/:id', authenticate, async (req, res) => res.json({msg: 'OK'}));
router.delete('/:id', authenticate, async (req, res) => res.json({msg: 'OK'}));
router.get('/:id/organistas', authenticate, async (req, res) => {
    const rows = await cicloRepository.getOrganistasDaIgreja(req.params.id);
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