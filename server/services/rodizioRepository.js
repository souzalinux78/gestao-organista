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
         c.hora as hora_culto
  FROM rodizios r
  INNER JOIN organistas o ON r.organista_id = o.id
  INNER JOIN igrejas i ON r.igreja_id = i.id
  INNER JOIN cultos c ON r.culto_id = c.id
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
 * @returns {Promise<boolean>} True se existe rodízio
 */
async function existeRodizio(cultoId, dataCulto) {
  const pool = db.getDb();
  const [rows] = await pool.execute(
    'SELECT id FROM rodizios WHERE culto_id = ? AND data_culto = ? LIMIT 1',
    [cultoId, dataCulto]
  );
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
  
  const query = `INSERT INTO rodizios 
    (igreja_id, culto_id, organista_id, data_culto, hora_culto, dia_semana, funcao, periodo_inicio, periodo_fim)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  for (const rodizio of rodizios) {
    await pool.execute(query, [
      rodizio.igreja_id,
      rodizio.culto_id,
      rodizio.organista_id,
      rodizio.data_culto,
      rodizio.hora_culto,
      rodizio.dia_semana,
      rodizio.funcao,
      rodizio.periodo_inicio,
      rodizio.periodo_fim
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
