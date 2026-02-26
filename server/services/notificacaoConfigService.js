const CONFIG_TTL_MS = 5 * 60 * 1000;
const configCache = new Map();

const CONFIG_KEYS = {
  destinatarios: (igrejaId) => `notificacao_destinatarios_igreja_${igrejaId}`,
  horarioDia: (igrejaId) => `notificacao_horario_dia_igreja_${igrejaId}`,
  horarioRjm: (igrejaId) => `notificacao_horario_rjm_igreja_${igrejaId}`
};

const DEFAULT_HORARIO_DIA = '10:00';
const DEFAULT_HORARIO_RJM = '18:00';

const CARGOS_DISPONIVEIS = [
  { key: 'encarregado_local', label: 'Encarregado Local' },
  { key: 'encarregado_regional', label: 'Encarregado Regional' },
  { key: 'anciao', label: 'Anciao' },
  { key: 'cooperador_oficio', label: 'Cooperador do Oficio' },
  { key: 'cooperador_jovens', label: 'Cooperador de Jovens' },
  { key: 'examinadoras', label: 'Examinadoras' },
  { key: 'diacono', label: 'Diacono' }
];

const CARGO_SET = new Set(CARGOS_DISPONIVEIS.map((c) => c.key));

function clearNotificacaoConfigCache(igrejaId = null) {
  if (igrejaId === null || igrejaId === undefined) {
    configCache.clear();
    return;
  }
  configCache.delete(Number(igrejaId));
}

function normalizeTime(value, fallback) {
  if (!value) return fallback;
  const normalized = String(value).trim();
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized) ? normalized : fallback;
}

function normalizeText(value, max = 140) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalizePhone(value, max = 30) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

function sanitizeDestinatarios(input) {
  if (!Array.isArray(input)) return [];

  const seen = new Set();
  const result = [];

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const cargo = CARGO_SET.has(raw.cargo) ? raw.cargo : '';
    const nome = normalizeText(raw.nome, 120);
    const telefone = normalizePhone(raw.telefone, 30);
    const ativo = raw.ativo !== false;

    if (!cargo || !telefone) continue;

    const dedupeKey = `${cargo}:${telefone}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    result.push({ cargo, nome, telefone, ativo });
    if (result.length >= 50) break;
  }

  return result;
}

function buildFallbackDestinatarios(igreja) {
  const fallback = [];

  if (igreja?.encarregado_local_telefone) {
    fallback.push({
      cargo: 'encarregado_local',
      nome: normalizeText(igreja.encarregado_local_nome, 120),
      telefone: normalizePhone(igreja.encarregado_local_telefone, 30),
      ativo: true
    });
  }

  if (igreja?.encarregado_regional_telefone) {
    fallback.push({
      cargo: 'encarregado_regional',
      nome: normalizeText(igreja.encarregado_regional_nome, 120),
      telefone: normalizePhone(igreja.encarregado_regional_telefone, 30),
      ativo: true
    });
  }

  return sanitizeDestinatarios(fallback);
}

async function getConfiguracaoEnvio(pool, igrejaId, igreja = null) {
  const igrejaIdNum = Number(igrejaId);
  const cacheItem = configCache.get(igrejaIdNum);
  const now = Date.now();
  if (cacheItem && cacheItem.expiresAt > now) {
    return cacheItem.value;
  }

  const keyDestinatarios = CONFIG_KEYS.destinatarios(igrejaIdNum);
  const keyHorarioDia = CONFIG_KEYS.horarioDia(igrejaIdNum);
  const keyHorarioRjm = CONFIG_KEYS.horarioRjm(igrejaIdNum);

  const [rows] = await pool.execute(
    'SELECT chave, valor FROM configuracoes WHERE chave IN (?, ?, ?)',
    [keyDestinatarios, keyHorarioDia, keyHorarioRjm]
  );

  const map = new Map(rows.map((r) => [r.chave, r.valor]));

  let destinatarios = [];
  const rawDestinatarios = map.get(keyDestinatarios);
  if (rawDestinatarios) {
    try {
      destinatarios = sanitizeDestinatarios(JSON.parse(rawDestinatarios));
    } catch (_e) {
      destinatarios = [];
    }
  }

  const fallbackDestinatarios = buildFallbackDestinatarios(igreja);
  if (destinatarios.length === 0) {
    destinatarios = fallbackDestinatarios;
  }

  const value = {
    igreja_id: igrejaIdNum,
    horario_dia: normalizeTime(map.get(keyHorarioDia), DEFAULT_HORARIO_DIA),
    horario_rjm: normalizeTime(map.get(keyHorarioRjm), DEFAULT_HORARIO_RJM),
    destinatarios,
    destinatarios_padrao: fallbackDestinatarios
  };

  configCache.set(igrejaIdNum, {
    value,
    expiresAt: now + CONFIG_TTL_MS
  });

  return value;
}

async function salvarConfiguracaoEnvio(pool, igrejaId, payload = {}, igreja = null) {
  const igrejaIdNum = Number(igrejaId);
  const horarioDia = normalizeTime(payload.horario_dia, DEFAULT_HORARIO_DIA);
  const horarioRjm = normalizeTime(payload.horario_rjm, DEFAULT_HORARIO_RJM);
  const destinatarios = sanitizeDestinatarios(payload.destinatarios);

  await pool.execute(
    `INSERT INTO configuracoes (chave, valor, descricao)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), descricao = VALUES(descricao), updated_at = CURRENT_TIMESTAMP`,
    [
      CONFIG_KEYS.horarioDia(igrejaIdNum),
      horarioDia,
      `Horario de envio para encarregados (dia) - igreja ${igrejaIdNum}`
    ]
  );

  await pool.execute(
    `INSERT INTO configuracoes (chave, valor, descricao)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), descricao = VALUES(descricao), updated_at = CURRENT_TIMESTAMP`,
    [
      CONFIG_KEYS.horarioRjm(igrejaIdNum),
      horarioRjm,
      `Horario de envio para encarregados (RJM) - igreja ${igrejaIdNum}`
    ]
  );

  await pool.execute(
    `INSERT INTO configuracoes (chave, valor, descricao)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), descricao = VALUES(descricao), updated_at = CURRENT_TIMESTAMP`,
    [
      CONFIG_KEYS.destinatarios(igrejaIdNum),
      JSON.stringify(destinatarios),
      `Destinatarios de notificacao por igreja ${igrejaIdNum}`
    ]
  );

  clearNotificacaoConfigCache(igrejaIdNum);
  return getConfiguracaoEnvio(pool, igrejaIdNum, igreja);
}

module.exports = {
  CONFIG_KEYS,
  CARGOS_DISPONIVEIS,
  DEFAULT_HORARIO_DIA,
  DEFAULT_HORARIO_RJM,
  getConfiguracaoEnvio,
  salvarConfiguracaoEnvio,
  clearNotificacaoConfigCache,
  sanitizeDestinatarios
};

