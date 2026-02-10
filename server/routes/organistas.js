const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, getUserIgrejas } = require('../middleware/auth');
const { tenantResolver, getTenantId } = require('../middleware/tenantResolver');
const { cachedColumnExists } = require('../utils/cache');

// Listar organistas (filtrado por igrejas do usuário e tenant)
router.get('/', authenticate, tenantResolver, async (req, res) => {
  try {
    const pool = db.getDb();
    const dbTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 8000);
    const tenantId = getTenantId(req);
    
    // Obter igrejas do usuário (já filtradas por tenant)
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    const igrejaIds = igrejas.map(i => i.id);
    
    if (igrejaIds.length === 0) {
      return res.json([]);
    }
    
    // Verificar se a coluna ordem existe em organistas_igreja (com cache)
    const ordemColumnExists = await cachedColumnExists('organistas_igreja', 'ordem');
    
    // Buscar organistas associadas às igrejas do usuário
    // Query compatível: funciona mesmo se a coluna ordem ainda não existir
    let rows;
    if (ordemColumnExists) {
      // Se coluna ordem existe, usar ordem de organistas_igreja
      [rows] = await pool.execute({
        sql: `SELECT DISTINCT o.*, 
                    MIN(oi.ordem) as ordem,
                    GROUP_CONCAT(DISTINCT oi.igreja_id) as igrejas_ids
             FROM organistas o
             INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
             WHERE oi.igreja_id IN (${igrejaIds.map(() => '?').join(',')})
             GROUP BY o.id
             ORDER BY (MIN(oi.ordem) IS NULL), MIN(oi.ordem) ASC, o.nome ASC`,
        values: igrejaIds,
        timeout: dbTimeout
      });
    } else {
      // Se coluna ordem não existe em organistas_igreja, listar sem ordem (compatibilidade)
      [rows] = await pool.execute({
        sql: `SELECT DISTINCT o.*,
                    GROUP_CONCAT(DISTINCT oi.igreja_id) as igrejas_ids
             FROM organistas o
             INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
             WHERE oi.igreja_id IN (${igrejaIds.map(() => '?').join(',')})
             GROUP BY o.id
             ORDER BY o.nome ASC`,
        values: igrejaIds,
        timeout: dbTimeout
      });
    }
    
    res.json(rows);
  } catch (error) {
    console.error('[DEBUG] Erro ao listar organistas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Buscar organista por ID (com verificação de acesso)
router.get('/:id', authenticate, tenantResolver, async (req, res) => {
  try {
    const pool = db.getDb();
    const tenantId = getTenantId(req);
    
    // Obter igrejas do usuário (já filtradas por tenant)
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
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
router.post('/', authenticate, tenantResolver, async (req, res) => {
  const startTime = Date.now();
  let organistaId = null;
  let ordemValue = undefined;
  
  try {
    console.log(`[DEBUG] Iniciando criação de organista - Usuário: ${req.user.id} (${req.user.role})`);
    
    const { nome, telefone, email, oficializada, ativa, ordem } = req.body;
    ordemValue = ordem;
    const pool = db.getDb();
    const dbTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 8000); // Reduzido para 8s
    
    // Validar nome obrigatório
    if (!nome || nome.trim() === '') {
      return res.status(400).json({ error: 'O nome da organista é obrigatório' });
    }
    
    console.log(`[DEBUG] Validação OK - Nome: ${nome.trim()}`);
    
    // Obter igrejas do usuário (com timeout e tratamento de erro)
    let igrejas = [];
    let igrejaIds = [];
    
    try {
      console.log(`[DEBUG] Buscando igrejas do usuário ${req.user.id}...`);
      const getUserIgrejasStart = Date.now();
      const tenantId = getTenantId(req);
      igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
      igrejaIds = igrejas.map(i => i.id);
      console.log(`[DEBUG] Igrejas encontradas (${Date.now() - getUserIgrejasStart}ms): ${igrejaIds.length} igreja(s) - IDs: [${igrejaIds.join(', ')}]`);
    } catch (getUserIgrejasError) {
      console.error(`[DEBUG] Erro ao buscar igrejas do usuário:`, getUserIgrejasError);
      // Continuar mesmo se falhar - usuário pode não ter igreja ainda
      igrejas = [];
      igrejaIds = [];
    }
    
    // Validar: usuário precisa ter pelo menos uma igreja para criar organista
    if (igrejaIds.length === 0) {
      return res.status(400).json({ 
        error: 'Você precisa ter pelo menos uma igreja cadastrada para criar organistas. Crie uma igreja primeiro.' 
      });
    }

    // Verificar se a coluna ordem existe em organistas_igreja (com cache)
    const ordemColumnExists = await cachedColumnExists('organistas_igreja', 'ordem');
    console.log(`[DEBUG] Coluna ordem em organistas_igreja: ${ordemColumnExists ? 'existe' : 'não existe'}`);

    // Se ordem fornecida e coluna existe, validar que não está duplicada (query única otimizada)
    if (ordemColumnExists && ordem !== undefined && ordem !== '' && Number(ordem) > 0 && igrejaIds.length > 0) {
      const ordemNum = Number(ordem);
      const [existing] = await pool.execute({
        sql: `SELECT id, igreja_id 
              FROM organistas_igreja 
              WHERE igreja_id IN (${igrejaIds.map(() => '?').join(',')}) 
                AND ordem = ?`,
        values: [...igrejaIds, ordemNum],
        timeout: dbTimeout
      });
      
      if (existing.length > 0) {
        return res.status(400).json({ 
          error: `Já existe uma organista com a ordem ${ordem} em uma das suas igrejas. Escolha outra ordem ou deixe em branco.` 
        });
      }
    }
    
    // Verificar se coluna tenant_id existe em organistas
    const temTenantIdOrganistas = await cachedColumnExists('organistas', 'tenant_id');
    const tenantId = getTenantId(req);
    
    // Validar tenant_id (obrigatório após FASE 5)
    if (temTenantIdOrganistas && !tenantId && req.user.role !== 'admin') {
      return res.status(400).json({ 
        error: 'tenant_id é obrigatório. Usuário deve estar associado a um tenant.' 
      });
    }
    
    // Obter tenant padrão se admin sem tenant (acesso global)
    let tenantIdParaOrganista = tenantId;
    if (temTenantIdOrganistas && !tenantId && req.user.role === 'admin') {
      const [tenants] = await pool.execute(
        'SELECT id FROM tenants WHERE slug = ? LIMIT 1',
        ['default']
      );
      tenantIdParaOrganista = tenants.length > 0 ? tenants[0].id : null;
    }
    
    // Criar organista com tenant_id se disponível
    console.log(`[DEBUG] Criando organista no banco...`);
    const insertStart = Date.now();
    
    let sqlOrganista, valuesOrganista;
    if (temTenantIdOrganistas && tenantIdParaOrganista) {
      sqlOrganista = 'INSERT INTO organistas (nome, telefone, email, oficializada, ativa, tenant_id) VALUES (?, ?, ?, ?, ?, ?)';
      valuesOrganista = [
        nome.trim(),
        telefone || null,
        email || null,
        oficializada ? 1 : 0,
        ativa !== undefined ? (ativa ? 1 : 0) : 1,
        tenantIdParaOrganista
      ];
    } else {
      sqlOrganista = 'INSERT INTO organistas (nome, telefone, email, oficializada, ativa) VALUES (?, ?, ?, ?, ?)';
      valuesOrganista = [
        nome.trim(),
        telefone || null,
        email || null,
        oficializada ? 1 : 0,
        ativa !== undefined ? (ativa ? 1 : 0) : 1
      ];
    }
    
    const [result] = await pool.execute({
      sql: sqlOrganista,
      values: valuesOrganista,
      timeout: dbTimeout
    });
    
    organistaId = result.insertId;
    console.log(`[DEBUG] Organista criada (${Date.now() - insertStart}ms) - ID: ${organistaId}`);
    
    // Associar organista às igrejas do usuário
    try {
      console.log(`[DEBUG] Associando organista ${organistaId} às ${igrejaIds.length} igreja(s)...`);
      const assocStart = Date.now();
      
      const oficializadaInt = oficializada ? 1 : 0;
      const ordemValue = ordem !== undefined && ordem !== '' ? Number(ordem) : null;
      
      // Inserir associações (otimizado: INSERT múltiplo em vez de loop)
      if (igrejaIds.length > 0) {
        if (ordemColumnExists) {
          // Se coluna ordem existe, inserir com ordem (INSERT múltiplo)
          const placeholders = igrejaIds.map(() => '(?, ?, ?, ?)').join(', ');
          const values = igrejaIds.flatMap(igrejaId => 
            [organistaId, igrejaId, oficializadaInt, ordemValue]
          );
          
          await pool.execute({
            sql: `INSERT INTO organistas_igreja (organista_id, igreja_id, oficializada, ordem) 
                  VALUES ${placeholders}`,
            values: values,
            timeout: dbTimeout
          });
          console.log(`[DEBUG] Organista associada (${Date.now() - assocStart}ms) às ${igrejaIds.length} igreja(s) com ordem: ${ordemValue || 'NULL'}`);
        } else {
          // Se coluna ordem não existe, inserir sem ordem (INSERT múltiplo)
          const placeholders = igrejaIds.map(() => '(?, ?, ?)').join(', ');
          const values = igrejaIds.flatMap(igrejaId => 
            [organistaId, igrejaId, oficializadaInt]
          );
          
          await pool.execute({
            sql: `INSERT INTO organistas_igreja (organista_id, igreja_id, oficializada) 
                  VALUES ${placeholders}`,
            values: values,
            timeout: dbTimeout
          });
          console.log(`[DEBUG] Organista associada (${Date.now() - assocStart}ms) às ${igrejaIds.length} igreja(s) (sem coluna ordem ainda)`);
        }
      }
    } catch (assocError) {
      console.error(`[DEBUG] Erro ao associar organista às igrejas:`, assocError);
      
      // Se for erro de ordem duplicada, dar mensagem específica
      if (assocError.code === 'ER_DUP_ENTRY') {
        if (assocError.message.includes('unique_organistas_igreja_ordem')) {
          return res.status(400).json({ 
            error: `Já existe uma organista com a ordem ${ordem} em uma das suas igrejas. Escolha outra ordem ou deixe em branco.` 
          });
        } else if (assocError.message.includes('unique_organista_igreja')) {
          return res.status(400).json({ 
            error: 'Esta organista já está associada a uma das suas igrejas.' 
          });
        }
      }
      
      // Outros erros de associação
      throw assocError;
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[DEBUG] Organista criada com sucesso em ${totalTime}ms - ID: ${organistaId}`);
    
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
    const totalTime = Date.now() - startTime;
    console.error(`[DEBUG] Erro ao criar organista (${totalTime}ms):`, {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      stack: error.stack
    });
    
    // Se o MySQL travar/demorar demais, evitar 504 do proxy e responder com erro claro
    if (error.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return res.status(503).json({ 
        error: 'Banco de dados demorou para responder. Tente novamente em instantes.',
        details: `Timeout após ${totalTime}ms`
      });
    }

    // Tratar erro de ordem duplicada
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('unique_organistas_ordem')) {
      return res.status(400).json({ 
        error: `Já existe uma organista com a ordem ${ordemValue}. Escolha outra ordem ou deixe em branco.` 
      });
    }
    
    // Tratar outros erros de constraint
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        error: 'Já existe uma organista com esses dados. Verifique os campos únicos.' 
      });
    }
    
    // Tratar erro de conexão
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({ 
        error: 'Não foi possível conectar ao banco de dados. Tente novamente em instantes.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Erro ao criar organista',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Atualizar organista (com verificação de acesso)
router.put('/:id', authenticate, tenantResolver, async (req, res) => {
  try {
    const { nome, telefone, email, oficializada, ativa, ordem } = req.body;
    const pool = db.getDb();
    const dbTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 8000);
    const tenantId = getTenantId(req);
    
    // Obter igrejas do usuário (já filtradas por tenant)
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    const igrejaIds = igrejas.map(i => i.id);
    
    // Verificar se a organista está associada a alguma igreja do usuário
    if (igrejaIds.length === 0) {
      return res.status(403).json({ error: 'Você não tem acesso a nenhuma igreja' });
    }
    
    const [check] = await pool.execute({
      sql: `SELECT o.id 
            FROM organistas o
            INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
            WHERE o.id = ? AND oi.igreja_id IN (${igrejaIds.map(() => '?').join(',')})
            LIMIT 1`,
      values: [req.params.id, ...igrejaIds],
      timeout: dbTimeout
    });
    
    if (check.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta organista' });
    }
    
    // Atualizar dados da organista (sem ordem - ordem fica em organistas_igreja)
    const [result] = await pool.execute({
      sql: 'UPDATE organistas SET nome = ?, telefone = ?, email = ?, oficializada = ?, ativa = ? WHERE id = ?',
      values: [
        nome,
        telefone || null,
        email || null,
        oficializada ? 1 : 0,
        ativa ? 1 : 0,
        req.params.id
      ],
      timeout: dbTimeout
    });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Organista não encontrada' });
    }
    
    // Atualizar ordem em organistas_igreja para todas as igrejas do usuário
    if (ordem !== undefined) {
      const ordemValue = ordem !== undefined && ordem !== '' ? Number(ordem) : null;
      
      // Validar ordem duplicada por igreja (query única otimizada)
      if (ordemValue !== null && ordemValue > 0 && igrejaIds.length > 0) {
        const [existing] = await pool.execute({
          sql: `SELECT id, igreja_id 
                FROM organistas_igreja 
                WHERE igreja_id IN (${igrejaIds.map(() => '?').join(',')}) 
                  AND ordem = ? 
                  AND organista_id != ?`,
          values: [...igrejaIds, ordemValue, req.params.id],
          timeout: dbTimeout
        });
        
        if (existing.length > 0) {
          return res.status(400).json({ 
            error: `Já existe outra organista com a ordem ${ordem} em uma das suas igrejas. Escolha outra ordem ou deixe em branco.` 
          });
        }
      }
      
      // Atualizar ordem para todas as associações da organista nas igrejas do usuário
      await pool.execute({
        sql: `UPDATE organistas_igreja 
              SET ordem = ? 
              WHERE organista_id = ? AND igreja_id IN (${igrejaIds.map(() => '?').join(',')})`,
        values: [ordemValue, req.params.id, ...igrejaIds],
        timeout: dbTimeout
      });
    }
    
    // Buscar ordem atualizada (pegar primeira igreja)
    const [ordemAtual] = await pool.execute({
      sql: 'SELECT ordem FROM organistas_igreja WHERE organista_id = ? AND igreja_id IN (?) LIMIT 1',
      values: [req.params.id, igrejaIds[0]],
      timeout: dbTimeout
    });
    
    res.json({ 
      id: req.params.id, 
      ordem: ordemAtual.length > 0 ? ordemAtual[0].ordem : null,
      nome, 
      telefone, 
      email, 
      oficializada, 
      ativa 
    });
  } catch (error) {
    console.error('[DEBUG] Erro ao atualizar organista:', error);
    
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('unique_organistas_igreja_ordem')) {
      return res.status(400).json({ 
        error: `Já existe uma organista com a ordem ${req.body.ordem} em uma das suas igrejas. Escolha outra ordem.` 
      });
    }
    
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

// Endpoint de teste rápido (sem autenticação para debug)
router.post('/test', async (req, res) => {
  try {
    const pool = db.getDb();
    const [result] = await pool.execute({
      sql: 'SELECT 1 as test',
      timeout: 5000
    });
    res.json({ status: 'ok', test: result[0].test, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
