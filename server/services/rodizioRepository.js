/**
 * Repository para operações de banco de dados relacionadas a rodízios
 * Centraliza queries complexas e elimina duplicação
 */

const db = require('../database/db');

/**
 * Query base para buscar rodízios com todos os JOINs necessários
 */
const RODIZIO_BASE_QUERY = `
  SELECT r.*, 
         o.nome as organista_nome, 
         o.telefone as organista_telefone, 
         o.email as organista_email,
         i.nome as igreja_nome,
         i.encarregado_local_nome, 
         i.encarregado_local_telefone,
         i.encarregado_regional_nome, 
         i.encarregado_regional_telefone,
         c.dia_semana, 
         c.hora as hora_culto,
         c.tipo as culto_tipo,
         o.categoria as organista_categoria,
         cic.nome as ciclo_nome,
         COALESCE(r.ciclo_origem, (SELECT ci.numero_ciclo FROM ciclo_itens ci WHERE ci.igreja_id = r.igreja_id AND ci.organista_id = r.organista_id ORDER BY ci.numero_ciclo ASC LIMIT 1)) AS ciclo_origem
  FROM rodizios r
  INNER JOIN organistas o ON r.organista_id = o.id
  INNER JOIN igrejas i ON r.igreja_id = i.id
  INNER JOIN cultos c ON r.culto_id = c.id
  LEFT JOIN ciclos cic ON r.ciclo_origem = cic.id
`;

/**
 * Busca rodízios completos com informações relacionadas
 * @param {number|number[]} igrejaIds - ID(s) da(s) igreja(s)
 * @param {string} periodoInicio - Data inicial (YYYY-MM-DD)
 * @param {string} periodoFim - Data final (YYYY-MM-DD)
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Array>} Array de rodízios
 */
async function buscarRodiziosCompletos(igrejaIds, periodoInicio = null, periodoFim = null, options = {}) {
  const pool = db.getDb();

  // Normalizar igrejaIds para array
  const igrejaIdsArray = Array.isArray(igrejaIds) ? igrejaIds : [igrejaIds];

  if (igrejaIdsArray.length === 0) {
    return [];
  }

  let query = RODIZIO_BASE_QUERY;
  const params = [];

  // Condição de igreja(s)
  const placeholders = igrejaIdsArray.map(() => '?').join(',');
  query += ` WHERE r.igreja_id IN (${placeholders})`;
  params.push(...igrejaIdsArray);

  // Condições de período
  if (periodoInicio) {
    query += ' AND r.data_culto >= ?';
    params.push(periodoInicio);
  }

  if (periodoFim) {
    query += ' AND r.data_culto <= ?';
    params.push(periodoFim);
  }

  // Ordenação
  const orderBy = options.orderBy || 'r.data_culto, r.hora_culto, r.funcao';
  query += ` ORDER BY ${orderBy}`;

  // Limite (se especificado)
  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  const [rows] = await pool.execute(query, params);
  return rows;
}

/**
 * Busca rodízios de uma data específica para uma igreja
 * @param {string} dataCulto - Data do culto (YYYY-MM-DD)
 * @param {number} igrejaId - ID da igreja
 * @returns {Promise<Array>} Array de rodízios do dia
 */
async function buscarRodiziosDoDia(dataCulto, igrejaId) {
  return buscarRodiziosCompletos(
    igrejaId,
    dataCulto,
    dataCulto,
    { orderBy: 'r.hora_culto, r.funcao' }
  );
}

/**
 * Verifica se existe rodízio para um culto em uma data específica
 * @param {number} cultoId - ID do culto
 * @param {string} dataCulto - Data do culto (YYYY-MM-DD)
 * @param {string} funcao - Função (opcional: 'meia_hora' ou 'tocar_culto')
 * @param {number} organistaId - ID da organista (opcional)
 * @returns {Promise<boolean>} True se existe rodízio
 */
async function existeRodizio(cultoId, dataCulto, funcao = null, organistaId = null) {
  const pool = db.getDb();
  let query = 'SELECT id FROM rodizios WHERE culto_id = ? AND data_culto = ?';
  const params = [cultoId, dataCulto];

  if (funcao) {
    query += ' AND funcao = ?';
    params.push(funcao);
  }

  if (organistaId) {
    query += ' AND organista_id = ?';
    params.push(organistaId);
  }

  query += ' LIMIT 1';

  const [rows] = await pool.execute(query, params);
  return rows.length > 0;
}

/**
 * Insere múltiplos rodízios no banco de dados
 * @param {Array} rodizios - Array de objetos de rodízio
 * @returns {Promise<void>}
 */
async function inserirRodizios(rodizios) {
  const pool = db.getDb();

  if (!Array.isArray(rodizios) || rodizios.length === 0) {
    return;
  }

  const query = `REPLACE INTO rodizios 
    (igreja_id, culto_id, organista_id, data_culto, hora_culto, dia_semana, funcao, periodo_inicio, periodo_fim, ciclo_origem)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  for (const rodizio of rodizios) {
    const cicloOrigem = rodizio.ciclo_origem ?? rodizio.ciclo ?? null;
    await pool.execute(query, [
      rodizio.igreja_id ?? null,
      rodizio.culto_id ?? null,
      rodizio.organista_id ?? null,
      rodizio.data_culto ?? null,
      rodizio.hora_culto ?? null,
      rodizio.dia_semana ?? null,
      rodizio.funcao ?? null,
      rodizio.periodo_inicio ?? null,
      rodizio.periodo_fim ?? null,
      cicloOrigem
    ]);
  }
}

/**
 * Atualiza um rodízio
 * @param {number} rodizioId - ID do rodízio
 * @param {Object} dados - Dados para atualizar
 * @returns {Promise<boolean>} True se atualizado com sucesso
 */
async function atualizarRodizio(rodizioId, dados) {
  const pool = db.getDb();

  const updates = [];
  const params = [];

  if (dados.organista_id !== undefined) {
    updates.push('organista_id = ?');
    params.push(dados.organista_id);
  }

  if (dados.data_culto !== undefined) {
    updates.push('data_culto = ?');
    params.push(dados.data_culto);
  }

  if (dados.hora_culto !== undefined) {
    updates.push('hora_culto = ?');
    params.push(dados.hora_culto);
  }

  if (updates.length === 0) {
    return false;
  }

  params.push(rodizioId);
  const [result] = await pool.execute(
    `UPDATE rodizios SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return result.affectedRows > 0;
}

/**
 * Deleta rodízios de uma igreja em um período
 * @param {number} igrejaId - ID da igreja
 * @param {string} periodoInicio - Data inicial (opcional)
 * @param {string} periodoFim - Data final (opcional)
 * @returns {Promise<number>} Número de rodízios deletados
 */
async function deletarRodizios(igrejaId, periodoInicio = null, periodoFim = null) {
  const pool = db.getDb();

  let query = 'DELETE FROM rodizios WHERE igreja_id = ?';
  const params = [igrejaId];

  if (periodoInicio) {
    query += ' AND data_culto >= ?';
    params.push(periodoInicio);
  }

  if (periodoFim) {
    query += ' AND data_culto <= ?';
    params.push(periodoFim);
  }

  const [result] = await pool.execute(query, params);
  return result.affectedRows;
}

/**
 * Deleta um rodízio específico
 * @param {number} rodizioId - ID do rodízio
 * @returns {Promise<boolean>} True se deletado com sucesso
 */
async function deletarRodizio(rodizioId) {
  const pool = db.getDb();
  const [result] = await pool.execute('DELETE FROM rodizios WHERE id = ?', [rodizioId]);
  return result.affectedRows > 0;
}

module.exports = {
  buscarRodiziosCompletos,
  buscarRodiziosDoDia,
  existeRodizio,
  inserirRodizios,
  atualizarRodizio,
  deletarRodizios,
  deletarRodizio,
  RODIZIO_BASE_QUERY
};
