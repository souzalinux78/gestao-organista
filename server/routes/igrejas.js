const express = require('express');
const router = express.Router();
const db = require('../database/db');
// Importando o Repository que grava na tabela CERTA (ciclo_itens)
const cicloRepository = require('../services/cicloRepository');
const { authenticate, getUserIgrejas, invalidateIgrejasCache } = require('../middleware/auth');
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

// --- ROTA 2: Ciclos Reais da Igreja ---
router.get('/:id/ciclos', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id) || 0;
    const pool = db.getDb();

    // Buscar ciclos reais da tabela 'ciclos'
    const [ciclos] = await pool.execute(
      'SELECT id, nome, ordem, ativo FROM ciclos WHERE igreja_id = ? AND ativo = 1 ORDER BY ordem ASC',
      [igrejaId]
    );

    res.json({
      igreja_id: igrejaId,
      total_ciclos: ciclos.length,
      ciclos: ciclos.map(c => ({
        id: c.id,
        nome: c.nome,
        numero_ciclo: c.id, // Para compatibilidade se necessário
        ordem: c.ordem
      }))
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- ROTA 3: Ler Itens (CORRIGIDO PARA ciclo_itens) ---
router.get('/:id/ciclos/:cicloId', authenticate, async (req, res) => {
  try {
    const igrejaId = parseInt(req.params.id) || 0;
    const cicloId = parseInt(req.params.cicloId) || 0;

    res.set('Cache-Control', 'no-store');

    // Usa o repository para garantir consistência
    const itens = await cicloRepository.getCicloItens(igrejaId, cicloId);

    const itensFormatados = itens.map(i => ({
      id: i.organista_id || i.id, // Fallback ID
      nome: i.organista_nome,
      ordem: i.posicao,
      oficializada: !!i.oficializada,
      categoria: i.categoria,
      organista: { id: i.organista_id, nome: i.organista_nome, oficializada: !!i.oficializada, categoria: i.categoria }
    }));

    res.json(itensFormatados);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- ROTA 4: SALVAR CICLO (AGORA USA O REPOSITORY CORRETO) ---
router.put('/:id/ciclos/:cicloId', authenticate, tenantResolver, async (req, res) => {
  console.log(`>>> ROTA SALVAR: Ciclo ${req.params.cicloId} da Igreja ${req.params.id}`);

  try {
    const igrejaId = parseInt(req.params.id) || 0;
    const cicloId = parseInt(req.params.cicloId) || 0;
    const { itens } = req.body || {};

    if (!Array.isArray(itens)) {
      return res.status(400).json({ error: "Dados inválidos: 'itens' deve ser um array." });
    }

    // AGORA: Chama a função salvarCiclo do repository que grava em ciclo_itens usando cicloId
    await cicloRepository.salvarCiclo(igrejaId, cicloId, itens);

    // Retorna os dados atualizados para confirmar visualmente
    const atualizado = await cicloRepository.getCicloItens(igrejaId, cicloId);

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
      ciclo: Number(o.ciclo),
      ordem: Number(o.posicao || o.ordem), // Compatibilidade
      organista: { id: o.id, nome: o.nome }
    }));
    res.json(organistasFormatadas);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Rotas auxiliares básicas
// --- ROTA 1.1: Criar Igreja ---
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      nome, endereco,
      encarregado_local_nome, encarregado_local_telefone,
      encarregado_regional_nome, encarregado_regional_telefone,
      mesma_organista_ambas_funcoes
    } = req.body;

    const pool = db.getDb();
    const [result] = await pool.execute(`
      INSERT INTO igrejas (
        nome, endereco, 
        encarregado_local_nome, encarregado_local_telefone, 
        encarregado_regional_nome, encarregado_regional_telefone,
        mesma_organista_ambas_funcoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      nome, endereco,
      encarregado_local_nome, encarregado_local_telefone,
      encarregado_regional_nome, encarregado_regional_telefone,
      mesma_organista_ambas_funcoes ? 1 : 0
    ]);
    invalidateIgrejasCache();
    res.json({ id: result.insertId, message: 'Igreja cadastrada com sucesso!' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  const pool = db.getDb();
  const [rows] = await pool.execute('SELECT * FROM igrejas WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Igreja não encontrada' });
  res.json(rows[0]);
});
// --- ROTA 6: Atualizar Igreja ---
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome,
      endereco,
      encarregado_local_nome,
      encarregado_local_telefone,
      encarregado_regional_nome,
      encarregado_regional_telefone,
      mesma_organista_ambas_funcoes
    } = req.body;

    console.log(`[IGREJAS] Atualizando igreja ${id}. Dobradinha (req.body):`, mesma_organista_ambas_funcoes);

    const pool = db.getDb();

    await pool.execute(`
      UPDATE igrejas 
      SET nome = ?, 
          endereco = ?, 
          encarregado_local_nome = ?, 
          encarregado_local_telefone = ?, 
          encarregado_regional_nome = ?, 
          encarregado_regional_telefone = ?,
          mesma_organista_ambas_funcoes = ?
      WHERE id = ?
    `, [
      nome,
      endereco,
      encarregado_local_nome,
      encarregado_local_telefone,
      encarregado_regional_nome,
      encarregado_regional_telefone,
      mesma_organista_ambas_funcoes ? 1 : 0,
      id
    ]);

    // INVALIDAR CACHE
    invalidateIgrejasCache();

    res.json({ message: 'Igreja atualizada com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => res.json({ msg: 'OK' }));
router.get('/:id/organistas', authenticate, async (req, res) => {
  const rows = await cicloRepository.getOrganistasDaIgreja(req.params.id);
  res.json(rows);
});
router.post('/:id/organistas', authenticate, async (req, res) => {
  const { organista_id } = req.body;
  const pool = db.getDb();
  await pool.execute('INSERT IGNORE INTO organistas_igreja (organista_id, igreja_id, oficializada) VALUES (?, ?, 1)', [organista_id, req.params.id]);
  res.json({ msg: 'OK' });
});
router.delete('/:id/organistas/:organista_id', authenticate, async (req, res) => {
  const pool = db.getDb();
  await pool.execute('DELETE FROM organistas_igreja WHERE igreja_id = ? AND organista_id = ?', [req.params.id, req.params.organista_id]);
  res.json({ msg: 'OK' });
});

module.exports = router;