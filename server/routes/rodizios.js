const express = require('express');
const router = express.Router();
const db = require('../database/db');
const rodizioService = require('../services/rodizioService');
const pdfService = require('../services/pdfService');
const webhookService = require('../services/webhookService');
const notificacaoService = require('../services/notificacaoService');
const { authenticate, getUserIgrejas, checkIgrejaAccess } = require('../middleware/auth');

// Listar rodízios (filtrado por igrejas do usuário)
router.get('/', authenticate, async (req, res) => {
  try {
    const { igreja_id, periodo_inicio, periodo_fim } = req.query;
    const pool = db.getDb();
    
    // Obter igrejas do usuário
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    const igrejaIds = igrejas.map(i => i.id);
    
    if (igrejaIds.length === 0) {
      return res.json([]);
    }
    
    // Se usuário comum especificou igreja_id, verificar acesso
    if (igreja_id && req.user.role !== 'admin') {
      if (!igrejaIds.includes(parseInt(igreja_id))) {
        return res.status(403).json({ error: 'Acesso negado a esta igreja' });
      }
    }
    
    let query = `
      SELECT r.*, 
             o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
             i.nome as igreja_nome,
             c.dia_semana, c.hora as hora_culto
      FROM rodizios r
      INNER JOIN organistas o ON r.organista_id = o.id
      INNER JOIN igrejas i ON r.igreja_id = i.id
      INNER JOIN cultos c ON r.culto_id = c.id
      WHERE r.igreja_id IN (${igrejaIds.map(() => '?').join(',')})
    `;
    const params = [...igrejaIds];
    
    if (igreja_id) {
      query += ' AND r.igreja_id = ?';
      params.push(igreja_id);
    }
    if (periodo_inicio) {
      query += ' AND r.data_culto >= ?';
      params.push(periodo_inicio);
    }
    if (periodo_fim) {
      query += ' AND r.data_culto <= ?';
      params.push(periodo_fim);
    }
    
    query += ' ORDER BY r.data_culto, r.hora_culto, r.funcao';
    
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gerar rodízio (com verificação de acesso à igreja)
router.post('/gerar', authenticate, async (req, res) => {
  try {
    const { igreja_id, periodo_meses, ciclo_inicial, data_inicial, organista_inicial } = req.body;
    
    if (!igreja_id || !periodo_meses) {
      return res.status(400).json({ error: 'igreja_id e periodo_meses são obrigatórios' });
    }
    
    // Aceitar 3, 6 ou 12 meses
    if (![3, 6, 12].includes(periodo_meses)) {
      return res.status(400).json({ error: 'periodo_meses deve ser 3, 6 ou 12' });
    }
    
    // Verificar acesso à igreja
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    const temAcesso = req.user.role === 'admin' || igrejas.some(i => i.id === parseInt(igreja_id));
    
    if (!temAcesso) {
      return res.status(403).json({ error: 'Acesso negado a esta igreja' });
    }
    
    // ciclo_inicial é opcional, mas se fornecido deve ser válido
    const cicloInicial = ciclo_inicial !== undefined && ciclo_inicial !== null && ciclo_inicial !== '' 
      ? parseInt(ciclo_inicial) 
      : null;
    
    const dataInicial = data_inicial && data_inicial !== '' ? data_inicial : null;
    const organistaInicial = organista_inicial !== undefined && organista_inicial !== null && organista_inicial !== '' 
      ? parseInt(organista_inicial) 
      : null;
    
    const rodizios = await rodizioService.gerarRodizio(igreja_id, periodo_meses, cicloInicial, dataInicial, organistaInicial);
    
    // Enviar para webhook
    try {
      await webhookService.enviarRodizio(rodizios);
    } catch (webhookError) {
      console.error('Erro ao enviar webhook:', webhookError);
      // Não falha a requisição se o webhook falhar
    }
    
    res.json({ 
      message: `Rodízio gerado com sucesso para ${periodo_meses} meses`,
      rodizios: rodizios.length,
      dados: rodizios
    });
  } catch (error) {
    console.error('Erro ao gerar rodízio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gerar PDF do rodízio (com verificação de acesso)
router.get('/pdf/:igreja_id', authenticate, async (req, res) => {
  try {
    // Verificar acesso à igreja
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    const temAcesso = req.user.role === 'admin' || igrejas.some(i => i.id === parseInt(req.params.igreja_id));
    
    if (!temAcesso) {
      return res.status(403).json({ error: 'Acesso negado a esta igreja' });
    }
    
    const { periodo_inicio, periodo_fim } = req.query;
    const pool = db.getDb();
    
    let query = `
      SELECT r.*, 
             o.nome as organista_nome, o.telefone as organista_telefone,
             i.nome as igreja_nome,
             c.dia_semana, c.hora as hora_culto
      FROM rodizios r
      INNER JOIN organistas o ON r.organista_id = o.id
      INNER JOIN igrejas i ON r.igreja_id = i.id
      INNER JOIN cultos c ON r.culto_id = c.id
      WHERE r.igreja_id = ?
    `;
    const params = [req.params.igreja_id];
    
    if (periodo_inicio) {
      query += ' AND r.data_culto >= ?';
      params.push(periodo_inicio);
    }
    if (periodo_fim) {
      query += ' AND r.data_culto <= ?';
      params.push(periodo_fim);
    }
    
    query += ' ORDER BY r.data_culto, c.hora';
    
    console.log('[DEBUG] Query PDF:', query);
    console.log('[DEBUG] Params PDF:', params);
    
    const [rows] = await pool.execute(query, params);
    
    console.log('[DEBUG] Rodízios encontrados para PDF:', rows.length);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Nenhum rodízio encontrado para o período selecionado' });
    }
    
    try {
      const pdfBuffer = await pdfService.gerarPDFRodizio(rows);
      res.contentType('application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rodizio_${req.params.igreja_id}_${Date.now()}.pdf"`);
      res.send(pdfBuffer);
    } catch (pdfError) {
      console.error('Erro ao gerar PDF:', pdfError);
      console.error('Stack trace:', pdfError.stack);
      res.status(500).json({ error: 'Erro ao gerar PDF: ' + pdfError.message });
    }
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar rodízio (com verificação de acesso)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { organista_id } = req.body;
    const pool = db.getDb();
    
    if (!organista_id) {
      return res.status(400).json({ error: 'organista_id é obrigatório' });
    }
    
    // Verificar acesso ao rodízio (através da igreja)
    const [rodizios] = await pool.execute('SELECT igreja_id FROM rodizios WHERE id = ?', [req.params.id]);
    if (rodizios.length === 0) {
      return res.status(404).json({ error: 'Rodízio não encontrado' });
    }
    
    if (req.user.role !== 'admin') {
      const [associations] = await pool.execute(
        'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
        [req.user.id, rodizios[0].igreja_id]
      );
      
      if (associations.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a este rodízio' });
      }
    }
    
    // Verificar se a organista existe e está ativa
    const [organistas] = await pool.execute('SELECT id, ativa FROM organistas WHERE id = ?', [organista_id]);
    if (organistas.length === 0) {
      return res.status(404).json({ error: 'Organista não encontrada' });
    }
    if (!organistas[0].ativa) {
      return res.status(400).json({ error: 'Organista não está ativa' });
    }
    
    // Atualizar rodízio
    const [result] = await pool.execute(
      'UPDATE rodizios SET organista_id = ? WHERE id = ?',
      [organista_id, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Rodízio não encontrado' });
    }
    
    res.json({ message: 'Rodízio atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar rodízio (com verificação de acesso)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    
    // Verificar acesso ao rodízio (através da igreja)
    if (req.user.role !== 'admin') {
      const [rodizios] = await pool.execute('SELECT igreja_id FROM rodizios WHERE id = ?', [req.params.id]);
      if (rodizios.length > 0) {
        const [associations] = await pool.execute(
          'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
          [req.user.id, rodizios[0].igreja_id]
        );
        
        if (associations.length === 0) {
          return res.status(403).json({ error: 'Acesso negado a este rodízio' });
        }
      }
    }
    
    const [result] = await pool.execute('DELETE FROM rodizios WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Rodízio não encontrado' });
    }
    
    res.json({ message: 'Rodízio deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar rodízios de uma igreja (com verificação de acesso)
router.delete('/igreja/:igreja_id', authenticate, async (req, res) => {
  try {
    // Verificar acesso à igreja
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    const temAcesso = req.user.role === 'admin' || igrejas.some(i => i.id === parseInt(req.params.igreja_id));
    
    if (!temAcesso) {
      return res.status(403).json({ error: 'Acesso negado a esta igreja' });
    }
    
    const { periodo_inicio, periodo_fim } = req.query;
    const pool = db.getDb();
    
    let query = 'DELETE FROM rodizios WHERE igreja_id = ?';
    const params = [req.params.igreja_id];
    
    if (periodo_inicio) {
      query += ' AND data_culto >= ?';
      params.push(periodo_inicio);
    }
    if (periodo_fim) {
      query += ' AND data_culto <= ?';
      params.push(periodo_fim);
    }
    
    const [result] = await pool.execute(query, params);
    res.json({ message: `${result.affectedRows} rodízio(s) deletado(s) com sucesso` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Testar webhook (simula envio de notificação)
router.post('/testar-webhook', authenticate, async (req, res) => {
  try {
    const pool = db.getDb();
    const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Buscar a próxima data de culto com rodízio (hoje ou futura)
    const [proximos] = await pool.execute(
      `SELECT r.*, 
              o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
              i.nome as igreja_nome,
              i.encarregado_local_nome, i.encarregado_local_telefone,
              i.encarregado_regional_nome, i.encarregado_regional_telefone,
              c.dia_semana, c.hora as hora_culto, r.funcao
       FROM rodizios r
       INNER JOIN organistas o ON r.organista_id = o.id
       INNER JOIN igrejas i ON r.igreja_id = i.id
       INNER JOIN cultos c ON r.culto_id = c.id
       WHERE r.data_culto >= ?
       ORDER BY r.data_culto ASC
       LIMIT 1`,
      [hoje]
    );
    
    if (proximos.length === 0) {
      return res.status(404).json({ error: 'Nenhum rodízio encontrado para teste. Gere um rodízio primeiro.' });
    }
    
    const rodizioBase = proximos[0];

    // Buscar TODOS os rodízios da mesma igreja e mesma data (meia_hora + tocar_culto)
    const [rodiziosDoDia] = await pool.execute(
      `SELECT r.*, 
              o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
              i.nome as igreja_nome,
              i.encarregado_local_nome, i.encarregado_local_telefone,
              i.encarregado_regional_nome, i.encarregado_regional_telefone,
              c.dia_semana, c.hora as hora_culto, r.funcao
       FROM rodizios r
       INNER JOIN organistas o ON r.organista_id = o.id
       INNER JOIN igrejas i ON r.igreja_id = i.id
       INNER JOIN cultos c ON r.culto_id = c.id
       WHERE r.data_culto = ?
         AND r.igreja_id = ?
       ORDER BY r.hora_culto, r.funcao`,
      [rodizioBase.data_culto, rodizioBase.igreja_id]
    );

    if (rodiziosDoDia.length === 0) {
      return res.status(404).json({ error: 'Nenhum rodízio encontrado para a data/igreja do teste.' });
    }
    
    // Simular envio de notificação (que chama o webhook)
    try {
      const resultados = [];

      // 1) Enviar webhook para cada organista (meia_hora e tocar_culto)
      for (const r of rodiziosDoDia) {
        await notificacaoService.enviarNotificacaoDiaCulto(r, false);
        resultados.push({
          organista: r.organista_nome,
          telefone: r.organista_telefone,
          data: r.data_culto,
          hora: r.hora_culto,
          funcao: r.funcao,
          igreja: r.igreja_nome
        });
      }

      // 2) Enviar 1 webhook consolidado para encarregados
      await notificacaoService.enviarNotificacaoEncarregados(rodiziosDoDia);

      res.json({ 
        message: 'Webhook testado com sucesso (organistas + encarregados)!',
        total_rodizios_testados: rodiziosDoDia.length,
        detalhes: resultados
      });
    } catch (webhookError) {
      res.status(500).json({ 
        error: 'Erro ao testar webhook: ' + webhookError.message,
        detalhes: {
          data: rodizioBase.data_culto,
          igreja_id: rodizioBase.igreja_id,
          igreja: rodizioBase.igreja_nome
        },
        total_rodizios_encontrados: rodiziosDoDia.length
      });
    }
  } catch (error) {
    console.error('Erro ao testar webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
