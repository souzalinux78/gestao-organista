/**
 * Repository para ciclo_itens (Gestão de Ciclos).
 * N cultos = N ciclos; cada ciclo é uma lista ordenada de organistas por posição.
 */

const db = require('../database/db');

/**
 * Quantidade de cultos ativos da igreja (= quantidade de ciclos).
 */
async function getQuantidadeCultos(igrejaId) {
  const pool = db.getDb();
  const [rows] = await pool.execute(
    'SELECT COUNT(*) as total FROM cultos WHERE igreja_id = ? AND ativo = 1',
    [igrejaId]
  );
  return rows[0]?.total ?? 0;
}

/**
 * Lista itens de um ciclo (igreja + número do ciclo), ordenados por posição.
 * Retorna organista_id, posicao e dados da organista (nome, oficializada).
 */
async function getCicloItens(igrejaId, numeroCiclo) {
  const pool = db.getDb();
  const [rows] = await pool.execute(
    `SELECT ci.id, ci.organista_id, ci.posicao,
            o.nome as organista_nome,
            COALESCE(oi.oficializada, o.oficializada, 0) as oficializada,
            o.ativa
     FROM ciclo_itens ci
     INNER JOIN organistas o ON o.id = ci.organista_id
     LEFT JOIN organistas_igreja oi ON oi.organista_id = o.id AND oi.igreja_id = ?
     WHERE ci.igreja_id = ? AND ci.numero_ciclo = ?
     ORDER BY ci.posicao ASC`,
    [igrejaId, igrejaId, numeroCiclo]
  );
  return rows;
}

/**
 * Salva a ordem de um ciclo: substitui todos os itens pelo array [ { organista_id, posicao } ].
 * posicao pode ser 0-based ou 1-based; normalizamos como 0-based internamente e gravamos 1-based se preferir (vou 0-based para facilitar índices).
 */
async function saveCicloItens(igrejaId, numeroCiclo, itens) {
  const pool = db.getDb();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM ciclo_itens WHERE igreja_id = ? AND numero_ciclo = ?', [igrejaId, numeroCiclo]);
    for (let i = 0; i < itens.length; i++) {
      const { organista_id } = itens[i];
      const posicao = typeof itens[i].posicao === 'number' ? itens[i].posicao : i;
      await conn.execute(
        'INSERT INTO ciclo_itens (igreja_id, numero_ciclo, organista_id, posicao) VALUES (?, ?, ?, ?)',
        [igrejaId, numeroCiclo, organista_id, posicao]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Lista organistas da igreja (para popular ciclos). Retorna id, nome, oficializada.
 */
async function getOrganistasDaIgreja(igrejaId) {
  const pool = db.getDb();
  const [rows] = await pool.execute(
    `SELECT o.id, o.nome,
            COALESCE(oi.oficializada, o.oficializada, 0) as oficializada,
            o.ativa
     FROM organistas o
     INNER JOIN organistas_igreja oi ON oi.organista_id = o.id AND oi.igreja_id = ?
     WHERE o.ativa = 1
     ORDER BY o.nome`,
    [igrejaId]
  );
  return rows;
}

/**
 * Para geração de rodízio: retorna lista de organistas de um ciclo ordenada por posição,
 * com id, nome, oficializada (1 ou 0).
 */
async function getCicloComoListaOrganistas(igrejaId, numeroCiclo) {
  const itens = await getCicloItens(igrejaId, numeroCiclo);
  return itens.map(item => ({
    id: item.organista_id,
    nome: item.organista_nome,
    oficializada: item.oficializada === 1 || item.oficializada === true
  }));
}

module.exports = {
  getQuantidadeCultos,
  getCicloItens,
  saveCicloItens,
  getOrganistasDaIgreja,
  getCicloComoListaOrganistas
};
