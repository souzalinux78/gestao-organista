/**
 * Repository para ciclo_itens (Gestão de Ciclos).
 * Responsável por salvar e recuperar a ordem dos organistas nos ciclos.
 * Tabela oficial: ciclo_itens
 */

const db = require('../database/db');

/**
 * Retorna a quantidade de cultos ativos (que define quantos ciclos existem).
 * OBSOLETO: Com a nova tabela ciclos, isso não define mais a quantidade de ciclos.
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
 * Lista itens de um ciclo específico, ordenados pela posição.
 * AGORA RECEBE CICLO_ID
 */
async function getCicloItens(igrejaId, cicloId) {
  const pool = db.getDb();
  const [rows] = await pool.execute(
    `SELECT ci.id, ci.organista_id, ci.posicao,
            o.nome as organista_nome,
            o.categoria,
            COALESCE(oi.oficializada, o.oficializada, 0) as oficializada,
            o.ativa
     FROM ciclo_itens ci
     INNER JOIN organistas o ON o.id = ci.organista_id
     LEFT JOIN organistas_igreja oi ON oi.organista_id = o.id AND oi.igreja_id = ?
     WHERE ci.igreja_id = ? AND ci.ciclo_id = ?
     ORDER BY ci.posicao ASC`,
    [igrejaId, igrejaId, cicloId]
  );
  return rows;
}

/**
 * Salva a ordem de um ciclo: LIMPA e INSERE novamente na tabela ciclo_itens.
 * Função padronizada para ser chamada pela Rota e pelo Service.
 * AGORA USA CICLO_ID
 */
async function salvarCiclo(igrejaId, cicloId, itens) {
  const pool = db.getDb();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    console.log(`[Repository] Salvando Ciclo ID ${cicloId} para Igreja ${igrejaId}. Itens: ${itens?.length}`);
    if (!itens) {
      console.warn('[Repository] Atenção: itens é null/undefined em salvarCiclo');
    }

    // 1. Limpa o ciclo atual na tabela CORRETA (ciclo_itens)
    await connection.execute(
      'DELETE FROM ciclo_itens WHERE igreja_id = ? AND ciclo_id = ?',
      [igrejaId, cicloId]
    );

    // 2. Insere os novos itens
    if (itens && Array.isArray(itens) && itens.length > 0) {

      const values = [];
      const placeholders = [];

      // Garante que a ordem siga a sequência do array enviado
      itens.forEach((item, index) => {
        // Tenta pegar o ID de todas as formas possíveis que o frontend possa mandar
        const organistaId = item.organista_id || item.id || (item.organista && item.organista.id);

        // A posição é o índice + 1 (1º, 2º, 3º...)
        // Se o frontend mandou 'ordem', usamos, senão usamos o índice
        const posicao = item.ordem || (index + 1);

        if (organistaId) {
          // numero_ciclo é mantido para compatibilidade com o índice UNIQUE
          // (igreja_id, numero_ciclo, organista_id)
          // Usamos o cicloId aqui também para garantir unicidade entre diferentes ciclos.
          values.push(igrejaId, cicloId, cicloId, organistaId, posicao);
          placeholders.push('(?, ?, ?, ?, ?)');
        }
      });

      if (values.length > 0) {
        const query = `INSERT INTO ciclo_itens (igreja_id, numero_ciclo, ciclo_id, organista_id, posicao) VALUES ${placeholders.join(', ')}`;
        await connection.execute(query, values);
      }
    }

    await connection.commit();
    return { success: true };

  } catch (error) {
    await connection.rollback();
    console.error('[CicloRepository] Erro ao salvar ciclo:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Lista organistas da igreja para popular a tela de seleção.
 */
async function getOrganistasDaIgreja(igrejaId) {
  const pool = db.getDb();
  const [rows] = await pool.execute(
    `SELECT o.id, o.nome, o.categoria,
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
 * Retorna uma lista simples de organistas de um ciclo (usado internamente).
 */
async function getCicloComoListaOrganistas(igrejaId, cicloId) {
  const itens = await getCicloItens(igrejaId, cicloId);
  return itens.map(item => ({
    id: item.organista_id,
    nome: item.organista_nome,
    oficializada: Boolean(item.oficializada),
    categoria: item.categoria
  }));
}

/**
 * Fila Mestra: TODAS as organistas de TODOS os ciclos.
 * [C1...] -> [C2...] -> [C3...]
 * AGORA JOIN CICLOS para ordenar corretamente
 */
async function getFilaMestra(igrejaId) {
  const pool = db.getDb();
  // Join com ciclos para pegar a ordem correta dos ciclos
  const [rows] = await pool.execute(
    `SELECT ci.ciclo_id, ci.posicao, ci.organista_id,
            o.nome as organista_nome, o.categoria,
            COALESCE(oi.oficializada, o.oficializada, 0) as oficializada,
            c.nome as ciclo_nome, c.ordem as ciclo_ordem
     FROM ciclo_itens ci
     INNER JOIN organistas o ON o.id = ci.organista_id
     INNER JOIN ciclos c ON c.id = ci.ciclo_id
     LEFT JOIN organistas_igreja oi ON oi.organista_id = o.id AND oi.igreja_id = ci.igreja_id
     WHERE ci.igreja_id = ? AND c.ativo = 1
     ORDER BY c.ordem ASC, ci.posicao ASC`,
    [igrejaId]
  );

  return rows.map(r => ({
    id: r.organista_id,
    nome: r.organista_nome,
    oficializada: Boolean(r.oficializada),
    categoria: r.categoria,
    ciclo: r.ciclo_id,
    ciclo_nome: r.ciclo_nome
  }));
}

module.exports = {
  getQuantidadeCultos,
  getCicloItens,
  salvarCiclo,
  saveCicloItens: salvarCiclo,
  getOrganistasDaIgreja,
  getCicloComoListaOrganistas,
  getFilaMestra
};