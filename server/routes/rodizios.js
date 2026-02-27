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

function normalizarHoraParaHHMMSS(horaInput) {
  if (typeof horaInput !== 'string') return null;
  const valor = horaInput.trim();

  const match24 = valor.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (match24) {
    const hh = match24[1];
    const mm = match24[2];
    const ss = match24[3] || '00';
    return `${hh}:${mm}:${ss}`;
  }

  const match12 = valor.match(/^(0?[1-9]|1[0-2]):([0-5]\d)(?::([0-5]\d))?\s*(AM|PM)$/i);
  if (match12) {
    let hh = parseInt(match12[1], 10);
    const mm = match12[2];
    const ss = match12[3] || '00';
    const period = match12[4].toUpperCase();

    if (period === 'AM' && hh === 12) hh = 0;
    if (period === 'PM' && hh !== 12) hh += 12;

    return `${String(hh).padStart(2, '0')}:${mm}:${ss}`;
  }

  return null;
}

// Listar rodÃ­zios (filtrado por igrejas do usuÃ¡rio e tenant)
router.get('/', authenticate, tenantResolver, async (req, res) => {
  try {
    const { igreja_id, periodo_inicio, periodo_fim } = req.query;
    const tenantId = getTenantId(req);

    // Obter igrejas do usuÃ¡rio (jÃ¡ filtradas por tenant)
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    const igrejaIds = igrejas.map(i => i.id);

    if (igrejaIds.length === 0) {
      return res.json([]);
    }

    // Se usuÃ¡rio comum especificou igreja_id, verificar acesso
    if (igreja_id && req.user.role !== 'admin') {
      if (!igrejaIds.includes(parseInt(igreja_id))) {
        return res.status(403).json({ error: 'Acesso negado a esta igreja' });
      }
    }

    // Usar repository para buscar rodÃ­zios
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

// Gerar rodÃ­zio (com verificaÃ§Ã£o de acesso Ã  igreja)
// CORREÃ‡ÃƒO: Adicionar tenantResolver antes de checkIgrejaAccess para garantir que req.tenantId esteja disponÃ­vel
router.post('/gerar', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    const { periodo_meses, ciclo_inicial, data_inicial, organista_inicial } = req.body;
    const igreja_id = req.igrejaId; // Vem do middleware checkIgrejaAccess

    if (!periodo_meses) {
      return res.status(400).json({ error: 'periodo_meses Ã© obrigatÃ³rio' });
    }

    // Aceitar 3, 6 ou 12 meses
    if (![3, 6, 12].includes(periodo_meses)) {
      return res.status(400).json({ error: 'periodo_meses deve ser 3, 6 ou 12' });
    }

    // ciclo_inicial Ã© opcional, mas se fornecido deve ser vÃ¡lido
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
      // NÃ£o falha a requisiÃ§Ã£o se o webhook falhar
    }

    res.json({
      message: `RodÃ­zio gerado com sucesso para ${periodo_meses} meses`,
      rodizios: rodizios.length,
      dados: rodizios
    });
  } catch (error) {
    console.error('Erro ao gerar rodÃ­zio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gerar PDF do rodÃ­zio (com verificaÃ§Ã£o de acesso)
// CORREÃ‡ÃƒO: Adicionar tenantResolver antes de checkIgrejaAccess
router.get('/pdf/:igreja_id', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    const { periodo_inicio, periodo_fim } = req.query;
    const igreja_id = req.igrejaId; // Vem do middleware checkIgrejaAccess

    // Usar repository para buscar rodÃ­zios
    const rows = await rodizioRepository.buscarRodiziosCompletos(
      igreja_id,
      periodo_inicio || null,
      periodo_fim || null,
      { orderBy: 'r.data_culto, c.hora' }
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Nenhum rodÃ­zio encontrado para o perÃ­odo selecionado' });
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

// Atualizar rodÃ­zio (com verificaÃ§Ã£o de acesso)
// Ajustar horário em massa (com verificação de acesso à igreja)
router.post('/ajustar-horario', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    const igreja_id = req.igrejaId;
    const { hora_de, hora_para, periodo_inicio, periodo_fim } = req.body || {};

    const horaDeNormalizada = normalizarHoraParaHHMMSS(hora_de);
    const horaParaNormalizada = normalizarHoraParaHHMMSS(hora_para);

    if (!horaDeNormalizada || !horaParaNormalizada) {
      return res.status(400).json({ error: 'hora_de e hora_para devem estar no formato HH:MM (24h) ou HH:MM AM/PM' });
    }

    if (horaDeNormalizada === horaParaNormalizada) {
      return res.status(400).json({ error: 'hora_de e hora_para não podem ser iguais' });
    }

    const atualizados = await rodizioRepository.atualizarHorarioEmMassa(
      igreja_id,
      horaDeNormalizada,
      horaParaNormalizada,
      periodo_inicio || null,
      periodo_fim || null
    );

    return res.json({
      message: `Horário atualizado com sucesso em ${atualizados} rodízio(s).`,
      atualizados
    });
  } catch (error) {
    console.error('Erro ao ajustar horário em massa:', error);
    return res.status(500).json({ error: error.message });
  }
});
router.put('/:id', authenticate, checkRodizioAccess, async (req, res) => {
  try {
    const { organista_id } = req.body;
    const pool = db.getDb();

    if (!organista_id) {
      return res.status(400).json({ error: 'organista_id Ã© obrigatÃ³rio' });
    }

    // Verificar se a organista existe e estÃ¡ ativa
    const [organistas] = await pool.execute('SELECT id, ativa FROM organistas WHERE id = ?', [organista_id]);
    if (organistas.length === 0) {
      return res.status(404).json({ error: 'Organista nÃ£o encontrada' });
    }
    if (!organistas[0].ativa) {
      return res.status(400).json({ error: 'Organista nÃ£o estÃ¡ ativa' });
    }

    // Atualizar rodÃ­zio usando repository
    const atualizado = await rodizioRepository.atualizarRodizio(req.rodizioId, { organista_id });

    if (!atualizado) {
      return res.status(404).json({ error: 'RodÃ­zio nÃ£o encontrado' });
    }

    res.json({ message: 'RodÃ­zio atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar rodÃ­zio (com verificaÃ§Ã£o de acesso)
router.delete('/:id', authenticate, checkRodizioAccess, async (req, res) => {
  try {
    // Usar repository para deletar
    const deletado = await rodizioRepository.deletarRodizio(req.rodizioId);

    if (!deletado) {
      return res.status(404).json({ error: 'RodÃ­zio nÃ£o encontrado' });
    }

    res.json({ message: 'RodÃ­zio deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar rodÃ­zios de uma igreja (com verificaÃ§Ã£o de acesso)
// CORREÃ‡ÃƒO: Adicionar tenantResolver antes de checkIgrejaAccess
router.delete('/igreja/:igreja_id', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    const { periodo_inicio, periodo_fim, a_partir_de } = req.query;
    const igreja_id = req.igrejaId; // Vem do middleware checkIgrejaAccess

    // Usar repository para deletar
    const deletados = await rodizioRepository.deletarRodizios(
      igreja_id,
      periodo_inicio || null,
      periodo_fim || null,
      a_partir_de || null // Novo parÃ¢metro para deletar do futuro
    );

    res.json({ message: `${deletados} rodÃ­zio(s) deletado(s) com sucesso` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refazer rodÃ­zio (Smart Regenerate)
router.post('/refazer', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    const { igreja_id, periodo_meses, ciclo_inicial, data_inicial, organista_inicial } = req.body;

    // 1. Limpar rodÃ­zios FUTUROS (da data inicial em diante)
    if (data_inicial) {
      await rodizioRepository.deletarRodizios(igreja_id, null, null, data_inicial);
    } else {
      // Se nÃ£o tem data, limpa tudo (comportamento padrÃ£o)
      await rodizioRepository.deletarRodizios(igreja_id);
    }

    // 2. Gerar novos
    const rodizios = await rodizioService.gerarRodizio(
      igreja_id,
      periodo_meses,
      ciclo_inicial ? parseInt(ciclo_inicial) : null,
      data_inicial || null,
      organista_inicial ? parseInt(organista_inicial) : null
    );

    res.json({
      message: `RodÃ­zio refeito com sucesso a partir de ${data_inicial || 'hoje'}`,
      rodizios: rodizios.length,
      dados: rodizios
    });

  } catch (error) {
    console.error('Erro ao refazer rodÃ­zio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Testar webhook (simula envio de notificaÃ§Ã£o)
router.post('/testar-webhook', authenticate, async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Obter todas as igrejas do usuÃ¡rio
    const tenantId = getTenantId(req);
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    const igrejaIds = igrejas.map(i => i.id);

    if (igrejaIds.length === 0) {
      return res.status(404).json({ error: 'Nenhuma igreja associada ao usuÃ¡rio' });
    }

    // Buscar a prÃ³xima data de culto com rodÃ­zio (hoje ou futura)
    const proximos = await rodizioRepository.buscarRodiziosCompletos(
      igrejaIds,
      hoje,
      null,
      { orderBy: 'r.data_culto ASC', limit: 1 }
    );

    if (proximos.length === 0) {
      return res.status(404).json({ error: 'Nenhum rodÃ­zio encontrado para teste. Gere um rodÃ­zio primeiro.' });
    }

    const rodizioBase = proximos[0];

    // Buscar TODOS os rodÃ­zios da mesma igreja e mesma data (meia_hora + tocar_culto)
    const rodiziosDoDia = await rodizioRepository.buscarRodiziosDoDia(
      rodizioBase.data_culto,
      rodizioBase.igreja_id
    );

    if (rodiziosDoDia.length === 0) {
      return res.status(404).json({ error: 'Nenhum rodÃ­zio encontrado para a data/igreja do teste.' });
    }

    // Simular envio de notificaÃ§Ã£o (que chama o webhook)
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
          console.error(`Erro ao enviar notificaÃ§Ã£o para ${r.organista_nome}:`, error.message);
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

// Importar rodÃ­zio via CSV (com verificaÃ§Ã£o de acesso Ã  igreja)
router.post('/importar', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    logger.info('[ROUTE] Iniciando importaÃ§Ã£o de rodÃ­zio via CSV', {
      userId: req.user?.id,
      igrejaId: req.igrejaId
    });

    const { csv_content } = req.body;
    const igreja_id = req.igrejaId; // Vem do middleware checkIgrejaAccess

    if (!csv_content) {
      logger.warn('[ROUTE] Tentativa de importaÃ§Ã£o sem conteÃºdo CSV');
      return res.status(400).json({ error: 'ConteÃºdo do CSV Ã© obrigatÃ³rio' });
    }

    if (typeof csv_content !== 'string') {
      logger.warn('[ROUTE] ConteÃºdo CSV nÃ£o Ã© string', { type: typeof csv_content });
      return res.status(400).json({ error: 'ConteÃºdo do CSV deve ser uma string' });
    }

    if (csv_content.trim().length === 0) {
      logger.warn('[ROUTE] ConteÃºdo CSV estÃ¡ vazio');
      return res.status(400).json({ error: 'ConteÃºdo do CSV estÃ¡ vazio' });
    }

    logger.info('[ROUTE] Processando CSV', { tamanho: csv_content.length });

    const resultado = await rodizioImportService.importarRodizio(
      req.user.id,
      igreja_id,
      csv_content
    );

    logger.info('[ROUTE] Resultado da importaÃ§Ã£o:', {
      sucesso: resultado.sucesso,
      rodiziosInseridos: resultado.rodiziosInseridos,
      totalLinhas: resultado.totalLinhas,
      erros: resultado.erros?.length || 0,
      duplicados: resultado.duplicados?.length || 0
    });

    if (!resultado.sucesso) {
      logger.warn('[ROUTE] ImportaÃ§Ã£o falhou com erros de validaÃ§Ã£o', {
        igrejaId: igreja_id,
        totalErros: resultado.erros?.length,
        primeirosErros: resultado.erros?.slice(0, 5)
      });
      return res.status(400).json({
        sucesso: false,
        error: 'Erros na importaÃ§Ã£o',
        erros: resultado.erros,
        details: resultado.erros // Adicionado para compatibilidade
      });
    }

    res.json({
      sucesso: true,
      message: `ImportaÃ§Ã£o concluÃ­da com sucesso! ${resultado.rodiziosInseridos} rodÃ­zio(s) inserido(s).`,
      rodiziosInseridos: resultado.rodiziosInseridos,
      totalLinhas: resultado.totalLinhas,
      duplicados: resultado.duplicados.length > 0 ? resultado.duplicados : undefined
    });
  } catch (error) {
    console.error('Erro ao importar rodÃ­zio:', error);
    // CORREÃ‡ÃƒO: Tratamento robusto de erros - nunca retornar 500 sem mensagem clara
    const errorMessage = error.message || 'Erro desconhecido ao importar rodÃ­zio';
    logger.error('Erro na importaÃ§Ã£o de rodÃ­zio:', {
      userId: req.user?.id,
      igrejaId: req.igrejaId ?? req.body?.igreja_id ?? null,
      error: errorMessage,
      stack: error.stack
    });
    // CORREÃ‡ÃƒO: Retornar erro claro ao frontend (sem falha silenciosa)
    res.status(400).json({
      sucesso: false,
      error: errorMessage,
      detalhes: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;


