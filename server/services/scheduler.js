const cron = require('node-cron');
const db = require('../database/db');
const notificacaoService = require('./notificacaoService');

const SCHEDULER_TIMEZONE = process.env.SCHEDULER_TIMEZONE || 'America/Sao_Paulo';

const obterRodiziosPendentesDoDia = async (pool) => {
  const [rodizios] = await pool.execute(
    `SELECT r.*, 
            o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
            i.nome as igreja_nome,
            i.encarregado_local_nome, i.encarregado_local_telefone,
            i.encarregado_regional_nome, i.encarregado_regional_telefone,
            c.dia_semana, c.hora as hora_culto, c.tipo as culto_tipo, r.funcao
     FROM rodizios r
     INNER JOIN organistas o ON r.organista_id = o.id
     INNER JOIN igrejas i ON r.igreja_id = i.id
     INNER JOIN cultos c ON r.culto_id = c.id
     WHERE r.data_culto = CURDATE()
     AND NOT EXISTS (
       SELECT 1 FROM notificacoes n 
       WHERE n.rodizio_id = r.id 
       AND n.tipo = 'alerta_dia_culto'
       AND DATE(n.created_at) = CURDATE()
     )
     AND NOT (
       c.tipo = 'rjm'
       AND DAYOFWEEK(r.data_culto) = 1
       AND c.hora = '10:00:00'
       AND EXISTS (
         SELECT 1 FROM notificacoes n2
         WHERE n2.rodizio_id = r.id
         AND n2.tipo = 'alerta_rjm_antecipado'
       )
     )`
  );
  return rodizios;
};

const obterRodiziosRjmDomingoPendentes = async (pool) => {
  const [rodizios] = await pool.execute(
    `SELECT r.*, 
            o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
            i.nome as igreja_nome,
            i.encarregado_local_nome, i.encarregado_local_telefone,
            i.encarregado_regional_nome, i.encarregado_regional_telefone,
            c.dia_semana, c.hora as hora_culto, c.tipo as culto_tipo, r.funcao
     FROM rodizios r
     INNER JOIN organistas o ON r.organista_id = o.id
     INNER JOIN igrejas i ON r.igreja_id = i.id
     INNER JOIN cultos c ON r.culto_id = c.id
     WHERE r.data_culto = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
     AND c.tipo = 'rjm'
     AND c.hora = '10:00:00'
     AND DAYOFWEEK(r.data_culto) = 1
     AND NOT EXISTS (
       SELECT 1 FROM notificacoes n 
       WHERE n.rodizio_id = r.id 
       AND n.tipo = 'alerta_rjm_antecipado'
     )`
  );
  return rodizios;
};

const processarRodizios = async (rodizios, options = {}) => {
  const tipoNotificacao = options.tipoNotificacao || 'alerta_dia_culto';
  const referencia = options.referencia || 'hoje';
  const contexto = options.contexto || 'processamento padrão';

  if (rodizios.length === 0) {
    console.log(`Nenhum rodízio encontrado para ${contexto}`);
    return;
  }

  console.log(`✅ Encontrados ${rodizios.length} rodízio(s) para ${contexto}`);

  const rodiziosMeiaHora = rodizios.filter(r => r.funcao === 'meia_hora');
  const rodiziosTocarCulto = rodizios.filter(r => r.funcao === 'tocar_culto');
  if (rodiziosMeiaHora.length > 0) {
    console.log(`🎵 Organistas para Meia Hora: ${rodiziosMeiaHora.length}`);
  }
  if (rodiziosTocarCulto.length > 0) {
    console.log(`🎹 Organistas para Tocar no Culto: ${rodiziosTocarCulto.length}`);
  }

  const rodiziosPorIgreja = {};
  for (const rodizio of rodizios) {
    const igrejaId = rodizio.igreja_id;
    if (!rodiziosPorIgreja[igrejaId]) {
      rodiziosPorIgreja[igrejaId] = [];
    }
    rodiziosPorIgreja[igrejaId].push(rodizio);
  }

  for (const [igrejaId, rodiziosIgreja] of Object.entries(rodiziosPorIgreja)) {
    console.log(`\n📋 Processando igreja ID: ${igrejaId} - ${rodiziosIgreja.length} rodízio(s)`);

    for (const rodizio of rodiziosIgreja) {
      try {
        const funcaoTexto = rodizio.funcao === 'meia_hora' ? '🎵 Meia Hora' : '🎹 Tocar no Culto';
        console.log(`📤 Processando: ${funcaoTexto} - Organista: ${rodizio.organista_nome} (ID: ${rodizio.id})`);

        await notificacaoService.enviarNotificacaoDiaCulto(
          rodizio,
          false,
          { tipoNotificacao }
        );
        console.log(`✅ Webhook enviado para organista: ${rodizio.organista_nome} - ${funcaoTexto}`);
      } catch (error) {
        console.error(`❌ Erro ao enviar notificação para rodízio ID ${rodizio.id}:`, error);
      }
    }

    if (rodiziosIgreja.length > 0) {
      const primeiroRodizio = rodiziosIgreja[0];
      try {
        await notificacaoService.enviarNotificacaoEncarregados(
          rodiziosIgreja,
          { referencia }
        );
        console.log(`✅ Webhook consolidado enviado para encarregados da igreja: ${primeiroRodizio.igreja_nome}`);
      } catch (error) {
        console.error(`❌ Erro ao enviar webhook para encarregados:`, error);
      }
    }
  }

  console.log(`\n✅ Processamento concluído: ${rodizios.length} rodízio(s) processado(s)`);
  console.log(`   - ${rodiziosMeiaHora.length} para Meia Hora`);
  console.log(`   - ${rodiziosTocarCulto.length} para Tocar no Culto`);
};

const init = () => {
  console.log('Inicializando agendador de notificações...');
  
  // Verificar rodízios do próprio dia (diariamente às 10:00)
  cron.schedule('0 10 * * *', async () => {
    console.log('Verificando rodízios do dia para envio de notificações...');
    await verificarERodiziosDoDia();
  }, { timezone: SCHEDULER_TIMEZONE });

  // Regra específica: RJM de domingo às 10:00 deve notificar sábado às 18:00
  cron.schedule('0 18 * * 6', async () => {
    console.log('Verificando RJM de domingo (10:00) para envio antecipado às 18:00 de sábado...');
    await verificarERjmDomingoAntecipado();
  }, { timezone: SCHEDULER_TIMEZONE });
  
  console.log(`Agendador configurado no fuso ${SCHEDULER_TIMEZONE}:`);
  console.log(' - diário às 10:00 (rodízios do dia)');
  console.log(' - sábado às 18:00 (RJM domingo 10:00)');
};

const verificarERodiziosDoDia = async () => {
  try {
    const pool = db.getDb();
    const rodizios = await obterRodiziosPendentesDoDia(pool);
    await processarRodizios(rodizios, {
      tipoNotificacao: 'alerta_dia_culto',
      referencia: 'hoje',
      contexto: 'hoje às 10:00'
    });
  } catch (error) {
    console.error('Erro ao buscar rodízios do dia:', error);
  }
};

const verificarERjmDomingoAntecipado = async () => {
  try {
    const pool = db.getDb();
    const rodizios = await obterRodiziosRjmDomingoPendentes(pool);
    await processarRodizios(rodizios, {
      tipoNotificacao: 'alerta_rjm_antecipado',
      referencia: 'amanhã',
      contexto: 'RJM de domingo às 10:00 (envio antecipado)'
    });
  } catch (error) {
    console.error('Erro ao buscar RJM de domingo para envio antecipado:', error);
  }
};

module.exports = {
  init
};
