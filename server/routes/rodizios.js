const express = require('express');
const router = express.Router();
const db = require('../database/db');
const rodizioService = require('../services/rodizioService');
const rodizioRepository = require('../services/rodizioRepository');
const rodizioImportService = require('../services/rodizioImportService');
const pdfService = require('../services/pdfService');
const webhookService = require('../services/webhookService');
const notificacaoService = require('../services/notificacaoService');
const { authenticate, getUserIgrejas } = require('../middleware/auth');
const { tenantResolver, getTenantId } = require('../middleware/tenantResolver');
const { checkIgrejaAccess, checkRodizioAccess } = require('../middleware/igrejaAccess');
const logger = require('../utils/logger');

// Listar rodízios (filtrado por igrejas do usuário e tenant)
router.get('/', authenticate, tenantResolver, async (req, res) => {
  try {
    const { igreja_id, periodo_inicio, periodo_fim } = req.query;
    const tenantId = getTenantId(req);
    
    // Obter igrejas do usuário (já filtradas por tenant)
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
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
    
    // Usar repository para buscar rodízios
    const igrejasParaBuscar = igreja_id ? [parseInt(igreja_id)] : igrejaIds;
    const rodizios = await rodizioRepository.buscarRodiziosCompletos(
      igrejasParaBuscar,
      periodo_inicio || null,
      periodo_fim || null
    );
    
    res.json(rodizios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gerar rodízio (com verificação de acesso à igreja)
// CORREÇÃO: Adicionar tenantResolver antes de checkIgrejaAccess para garantir que req.tenantId esteja disponível
router.post('/gerar', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    const { periodo_meses, ciclo_inicial, data_inicial, organista_inicial } = req.body;
    const igreja_id = req.igrejaId; // Vem do middleware checkIgrejaAccess
    
    if (!periodo_meses) {
      return res.status(400).json({ error: 'periodo_meses é obrigatório' });
    }
    
    // Aceitar 3, 6 ou 12 meses
    if (![3, 6, 12].includes(periodo_meses)) {
      return res.status(400).json({ error: 'periodo_meses deve ser 3, 6 ou 12' });
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
// CORREÇÃO: Adicionar tenantResolver antes de checkIgrejaAccess
router.get('/pdf/:igreja_id', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    const { periodo_inicio, periodo_fim } = req.query;
    const igreja_id = req.igrejaId; // Vem do middleware checkIgrejaAccess
    
    // Usar repository para buscar rodízios
    const rows = await rodizioRepository.buscarRodiziosCompletos(
      igreja_id,
      periodo_inicio || null,
      periodo_fim || null,
      { orderBy: 'r.data_culto, c.hora' }
    );
    
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
router.put('/:id', authenticate, checkRodizioAccess, async (req, res) => {
  try {
    const { organista_id } = req.body;
    const pool = db.getDb();
    
    if (!organista_id) {
      return res.status(400).json({ error: 'organista_id é obrigatório' });
    }
    
    // Verificar se a organista existe e está ativa
    const [organistas] = await pool.execute('SELECT id, ativa FROM organistas WHERE id = ?', [organista_id]);
    if (organistas.length === 0) {
      return res.status(404).json({ error: 'Organista não encontrada' });
    }
    if (!organistas[0].ativa) {
      return res.status(400).json({ error: 'Organista não está ativa' });
    }
    
    // Atualizar rodízio usando repository
    const atualizado = await rodizioRepository.atualizarRodizio(req.rodizioId, { organista_id });
    
    if (!atualizado) {
      return res.status(404).json({ error: 'Rodízio não encontrado' });
    }
    
    res.json({ message: 'Rodízio atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar rodízio (com verificação de acesso)
router.delete('/:id', authenticate, checkRodizioAccess, async (req, res) => {
  try {
    // Usar repository para deletar
    const deletado = await rodizioRepository.deletarRodizio(req.rodizioId);
    
    if (!deletado) {
      return res.status(404).json({ error: 'Rodízio não encontrado' });
    }
    
    res.json({ message: 'Rodízio deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar rodízios de uma igreja (com verificação de acesso)
// CORREÇÃO: Adicionar tenantResolver antes de checkIgrejaAccess
router.delete('/igreja/:igreja_id', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    const { periodo_inicio, periodo_fim } = req.query;
    const igreja_id = req.igrejaId; // Vem do middleware checkIgrejaAccess
    
    // Usar repository para deletar
    const deletados = await rodizioRepository.deletarRodizios(
      igreja_id,
      periodo_inicio || null,
      periodo_fim || null
    );
    
    res.json({ message: `${deletados} rodízio(s) deletado(s) com sucesso` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Testar webhook (simula envio de notificação)
router.post('/testar-webhook', authenticate, async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Obter todas as igrejas do usuário
    const tenantId = getTenantId(req);
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    const igrejaIds = igrejas.map(i => i.id);
    
    if (igrejaIds.length === 0) {
      return res.status(404).json({ error: 'Nenhuma igreja associada ao usuário' });
    }
    
    // Buscar a próxima data de culto com rodízio (hoje ou futura)
    const proximos = await rodizioRepository.buscarRodiziosCompletos(
      igrejaIds,
      hoje,
      null,
      { orderBy: 'r.data_culto ASC', limit: 1 }
    );
    
    if (proximos.length === 0) {
      return res.status(404).json({ error: 'Nenhum rodízio encontrado para teste. Gere um rodízio primeiro.' });
    }
    
    const rodizioBase = proximos[0];

    // Buscar TODOS os rodízios da mesma igreja e mesma data (meia_hora + tocar_culto)
    const rodiziosDoDia = await rodizioRepository.buscarRodiziosDoDia(
      rodizioBase.data_culto,
      rodizioBase.igreja_id
    );

    if (rodiziosDoDia.length === 0) {
      return res.status(404).json({ error: 'Nenhum rodízio encontrado para a data/igreja do teste.' });
    }
    
    // Simular envio de notificação (que chama o webhook)
    try {
      // 1) Enviar webhook para cada organista (meia_hora e tocar_culto) - paralelizado
      const notificacoesPromises = rodiziosDoDia.map(async (r) => {
        try {
          await notificacaoService.enviarNotificacaoDiaCulto(r, false);
          return {
            organista: r.organista_nome,
            telefone: r.organista_telefone,
            data: r.data_culto,
            hora: r.hora_culto,
            funcao: r.funcao,
            igreja: r.igreja_nome,
            sucesso: true
          };
        } catch (error) {
          console.error(`Erro ao enviar notificação para ${r.organista_nome}:`, error.message);
          return {
            organista: r.organista_nome,
            data: r.data_culto,
            sucesso: false,
            erro: error.message
          };
        }
      });
      
      const resultados = await Promise.all(notificacoesPromises);

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

// Importar rodízio via CSV (com verificação de acesso à igreja)
router.post('/importar', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    logger.info('[ROUTE] Iniciando importação de rodízio via CSV', {
      userId: req.user?.id,
      igrejaId: req.igrejaId
    });
    
    const { csv_content } = req.body;
    const igreja_id = req.igrejaId; // Vem do middleware checkIgrejaAccess
    
    if (!csv_content) {
      logger.warn('[ROUTE] Tentativa de importação sem conteúdo CSV');
      return res.status(400).json({ error: 'Conteúdo do CSV é obrigatório' });
    }
    
    if (typeof csv_content !== 'string') {
      logger.warn('[ROUTE] Conteúdo CSV não é string', { type: typeof csv_content });
      return res.status(400).json({ error: 'Conteúdo do CSV deve ser uma string' });
    }
    
    if (csv_content.trim().length === 0) {
      logger.warn('[ROUTE] Conteúdo CSV está vazio');
      return res.status(400).json({ error: 'Conteúdo do CSV está vazio' });
    }
    
    logger.info('[ROUTE] Processando CSV', { tamanho: csv_content.length });
    
    const resultado = await rodizioImportService.importarRodizio(
      req.user.id,
      igreja_id,
      csv_content
    );
    
    logger.info('[ROUTE] Resultado da importação:', {
      sucesso: resultado.sucesso,
      rodiziosInseridos: resultado.rodiziosInseridos,
      totalLinhas: resultado.totalLinhas,
      erros: resultado.erros?.length || 0,
      duplicados: resultado.duplicados?.length || 0
    });
    
    if (!resultado.sucesso) {
      return res.status(400).json({
        error: 'Erros na importação',
        detalhes: resultado.erros,
        duplicados: resultado.duplicados,
        rodiziosInseridos: resultado.rodiziosInseridos,
        totalLinhas: resultado.totalLinhas
      });
    }
    
    res.json({
      message: `Importação concluída com sucesso! ${resultado.rodiziosInseridos} rodízio(s) inserido(s).`,
      rodiziosInseridos: resultado.rodiziosInseridos,
      totalLinhas: resultado.totalLinhas,
      duplicados: resultado.duplicados.length > 0 ? resultado.duplicados : undefined
    });
  } catch (error) {
    console.error('Erro ao importar rodízio:', error);
    // CORREÇÃO: Tratamento robusto de erros - nunca retornar 500 sem mensagem clara
    const errorMessage = error.message || 'Erro desconhecido ao importar rodízio';
    logger.error('Erro na importação de rodízio:', {
      userId: req.user?.id,
      igrejaId: igreja_id,
      error: errorMessage,
      stack: error.stack
    });
    res.status(500).json({ 
      error: errorMessage,
      detalhes: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
