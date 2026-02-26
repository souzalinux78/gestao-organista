const cron = require('node-cron');
const db = require('../database/db');
const notificacaoService = require('./notificacaoService');
const { getConfiguracaoEnvio } = require('./notificacaoConfigService');

const SCHEDULER_TIMEZONE = process.env.SCHEDULER_TIMEZONE || 'America/Sao_Paulo';

const QUERY_BASE = `SELECT r.*, 
        o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
        i.nome as igreja_nome,
        i.encarregado_local_nome, i.encarregado_local_telefone,
        i.encarregado_regional_nome, i.encarregado_regional_telefone,
        c.dia_semana, c.hora as hora_culto, c.tipo as culto_tipo, r.funcao
 FROM rodizios r
 INNER JOIN organistas o ON r.organista_id = o.id
 INNER JOIN igrejas i ON r.igreja_id = i.id
 INNER JOIN cultos c ON r.culto_id = c.id`;

const agruparPorIgreja = (rodizios) => {
  const mapa = {};
  for (const rodizio of rodizios) {
    const igrejaId = rodizio.igreja_id;
    if (!mapa[igrejaId]) {
      mapa[igrejaId] = [];
    }
    mapa[igrejaId].push(rodizio);
  }
  return mapa;
};

const getHorarioAtualHHMM = () => {
  const horario = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SCHEDULER_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());

  return horario.replace('.', ':');
};

const obterRodiziosPendentesDoDia = async (pool) => {
  const [rodizios] = await pool.execute(
    `${QUERY_BASE}
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
    `${QUERY_BASE}
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

const obterRodiziosPendentesConsolidadoDia = async (pool) => {
  const [rodizios] = await pool.execute(
    `${QUERY_BASE}
     WHERE r.data_culto = CURDATE()
     AND NOT (c.tipo = 'rjm' AND DAYOFWEEK(r.data_culto) = 1 AND c.hora = '10:00:00')
     AND NOT EXISTS (
       SELECT 1 FROM notificacoes n
       WHERE n.rodizio_id = r.id
       AND n.tipo = 'alerta_encarregados_dia'
     )`
  );
  return rodizios;
};

const obterRodiziosPendentesConsolidadoRjm = async (pool) => {
  const [rodizios] = await pool.execute(
    `${QUERY_BASE}
     WHERE r.data_culto = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
     AND c.tipo = 'rjm'
     AND c.hora = '10:00:00'
     AND DAYOFWEEK(r.data_culto) = 1
     AND NOT EXISTS (
       SELECT 1 FROM notificacoes n
       WHERE n.rodizio_id = r.id
       AND n.tipo = 'alerta_encarregados_rjm_antecipado'
     )`
  );
  return rodizios;
};

const processarRodiziosOrganistas = async (rodizios, options = {}) => {
  const tipoNotificacao = options.tipoNotificacao || 'alerta_dia_culto';
  const contexto = options.contexto || 'processamento padrao';

  if (!rodizios || rodizios.length === 0) {
    console.log(`Nenhum rodizio encontrado para ${contexto}`);
    return;
  }

  console.log(`Encontrados ${rodizios.length} rodizio(s) para ${contexto}`);
  const rodiziosPorIgreja = agruparPorIgreja(rodizios);

  for (const [igrejaId, rodiziosIgreja] of Object.entries(rodiziosPorIgreja)) {
    console.log(`Processando igreja ${igrejaId}: ${rodiziosIgreja.length} rodizio(s)`);

    for (const rodizio of rodiziosIgreja) {
      try {
        await notificacaoService.enviarNotificacaoDiaCulto(
          rodizio,
          false,
          { tipoNotificacao }
        );
      } catch (error) {
        console.error(`Erro ao enviar notificacao para rodizio ID ${rodizio.id}:`, error.message);
      }
    }
  }
};

const processarConsolidadoConfiguravel = async (rodizios, options = {}) => {
  if (!rodizios || rodizios.length === 0) return;

  const pool = db.getDb();
  const agoraHHMM = options.agoraHHMM;
  const referencia = options.referencia || 'hoje';
  const campoHorario = options.campoHorario || 'horario_dia';
  const tipoNotificacaoRegistro = options.tipoNotificacaoRegistro;

  const rodiziosPorIgreja = agruparPorIgreja(rodizios);

  for (const rodiziosIgreja of Object.values(rodiziosPorIgreja)) {
    const primeiroRodizio = rodiziosIgreja[0];

    try {
      const configEnvio = await getConfiguracaoEnvio(pool, primeiroRodizio.igreja_id, primeiroRodizio);
      const horarioConfigurado = configEnvio[campoHorario];

      if (horarioConfigurado !== agoraHHMM) {
        continue;
      }

      await notificacaoService.enviarNotificacaoEncarregados(rodiziosIgreja, {
        referencia,
        tipoNotificacaoRegistro
      });

      console.log(`Consolidado enviado para igreja ${primeiroRodizio.igreja_nome} no horario ${agoraHHMM}`);
    } catch (error) {
      console.error(`Erro ao enviar consolidado da igreja ${primeiroRodizio.igreja_id}:`, error.message);
    }
  }
};

const verificarERodiziosDoDia = async () => {
  try {
    const pool = db.getDb();
    const rodizios = await obterRodiziosPendentesDoDia(pool);
    await processarRodiziosOrganistas(rodizios, {
      tipoNotificacao: 'alerta_dia_culto',
      contexto: 'hoje as 10:00'
    });
  } catch (error) {
    console.error('Erro ao buscar rodizios do dia:', error.message);
  }
};

const verificarERjmDomingoAntecipado = async () => {
  try {
    const pool = db.getDb();
    const rodizios = await obterRodiziosRjmDomingoPendentes(pool);
    await processarRodiziosOrganistas(rodizios, {
      tipoNotificacao: 'alerta_rjm_antecipado',
      contexto: 'RJM domingo 10:00 antecipado'
    });
  } catch (error) {
    console.error('Erro ao buscar RJM antecipado:', error.message);
  }
};

const verificarConsolidadosConfiguraveis = async () => {
  try {
    const pool = db.getDb();
    const agoraHHMM = getHorarioAtualHHMM();

    const [rodiziosDia, rodiziosRjm] = await Promise.all([
      obterRodiziosPendentesConsolidadoDia(pool),
      obterRodiziosPendentesConsolidadoRjm(pool)
    ]);

    await processarConsolidadoConfiguravel(rodiziosDia, {
      agoraHHMM,
      referencia: 'hoje',
      campoHorario: 'horario_dia',
      tipoNotificacaoRegistro: 'alerta_encarregados_dia'
    });

    await processarConsolidadoConfiguravel(rodiziosRjm, {
      agoraHHMM,
      referencia: 'amanha',
      campoHorario: 'horario_rjm',
      tipoNotificacaoRegistro: 'alerta_encarregados_rjm_antecipado'
    });
  } catch (error) {
    console.error('Erro no scheduler de consolidados configuraveis:', error.message);
  }
};

const init = () => {
  console.log('Inicializando agendador de notificacoes...');

  cron.schedule('0 10 * * *', async () => {
    console.log('Verificando rodizios do dia para envio das organistas...');
    await verificarERodiziosDoDia();
  }, { timezone: SCHEDULER_TIMEZONE });

  cron.schedule('0 18 * * 6', async () => {
    console.log('Verificando RJM de domingo (10:00) para envio antecipado as 18:00 de sabado...');
    await verificarERjmDomingoAntecipado();
  }, { timezone: SCHEDULER_TIMEZONE });

  cron.schedule('* * * * *', async () => {
    await verificarConsolidadosConfiguraveis();
  }, { timezone: SCHEDULER_TIMEZONE });

  console.log(`Agendador configurado no fuso ${SCHEDULER_TIMEZONE}:`);
  console.log(' - diario as 10:00 (mensagem da organista do dia)');
  console.log(' - sabado as 18:00 (RJM domingo 10:00 para organista)');
  console.log(' - a cada minuto (consolidado configuravel para encarregados)');
};

module.exports = {
  init
};
