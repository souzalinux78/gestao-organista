/**
 * Repository para ciclo_itens (Gestão de Ciclos).
 * Responsável por salvar e recuperar a ordem dos organistas nos ciclos.
 * Tabela oficial: ciclo_itens
 */

const db = require('../database/db');

/**
 * Retorna a quantidade de cultos ativos (que define quantos ciclos existem).
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
 * Salva a ordem de um ciclo: LIMPA e INSERE novamente na tabela ciclo_itens.
 * Função padronizada para ser chamada pela Rota e pelo Service.
 */
async function salvarCiclo(igrejaId, numeroCiclo, itens) {
  const pool = db.getDb();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    console.log(`[Repository] Salvando Ciclo ${numeroCiclo} para Igreja ${igrejaId}. Itens: ${itens?.length}`);

    // 1. Limpa o ciclo atual na tabela CORRETA (ciclo_itens)
    await connection.execute(
      'DELETE FROM ciclo_itens WHERE igreja_id = ? AND numero_ciclo = ?',
      [igrejaId, numeroCiclo]
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
          values.push(igrejaId, numeroCiclo, organistaId, posicao);
          placeholders.push('(?, ?, ?, ?)');
        }
      });

      if (values.length > 0) {
        const query = `INSERT INTO ciclo_itens (igreja_id, numero_ciclo, organista_id, posicao) VALUES ${placeholders.join(', ')}`;
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
 * Retorna uma lista simples de organistas de um ciclo (usado internamente).
 */
async function getCicloComoListaOrganistas(igrejaId, numeroCiclo) {
  const itens = await getCicloItens(igrejaId, numeroCiclo);
  return itens.map(item => ({
    id: item.organista_id,
    nome: item.organista_nome,
    oficializada: Boolean(item.oficializada)
  }));
}

/**
 * Fila Mestra: TODAS as organistas de TODOS os ciclos.
 * [C1...] -> [C2...] -> [C3...]
 */
async function getFilaMestra(igrejaId) {
  const pool = db.getDb();
  const [rows] = await pool.execute(
    `SELECT ci.numero_ciclo, ci.posicao, ci.organista_id,
            o.nome as organista_nome,
            COALESCE(oi.oficializada, o.oficializada, 0) as oficializada
     FROM ciclo_itens ci
     INNER JOIN organistas o ON o.id = ci.organista_id
     LEFT JOIN organistas_igreja oi ON oi.organista_id = o.id AND oi.igreja_id = ci.igreja_id
     WHERE ci.igreja_id = ?
     ORDER BY ci.numero_ciclo ASC, ci.posicao ASC`,
    [igrejaId]
  );
  
  return rows.map(r => ({
    id: r.organista_id,
    nome: r.organista_nome,
    oficializada: Boolean(r.oficializada),
    numero_ciclo: r.numero_ciclo
  }));
}

/**
 * Fila Mestra OFICIAIS: Apenas organistas oficializadas.
 * Usado pelo Gerador de Rodízio para pular alunas.
 */
async function getFilaMestraOficiais(igrejaId) {
  const pool = db.getDb();
  const [rows] = await pool.execute(
    `SELECT ci.numero_ciclo, ci.posicao, ci.organista_id,
            o.nome as organista_nome,
            COALESCE(oi.oficializada, o.oficializada, 0) as oficializada
     FROM ciclo_itens ci
     INNER JOIN organistas o ON o.id = ci.organista_id
     LEFT JOIN organistas_igreja oi ON oi.organista_id = o.id AND oi.igreja_id = ci.igreja_id
     WHERE ci.igreja_id = ?
       AND (o.oficializada = 1 OR oi.oficializada = 1)
     ORDER BY ci.numero_ciclo ASC, ci.posicao ASC`,
    [igrejaId]
  );
  
  return rows.map(r => ({
    id: r.organista_id,
    nome: r.organista_nome,
    ciclo: r.numero_ciclo,
    numero_ciclo: r.numero_ciclo
  }));
}

// Mantendo compatibilidade de nomes antigos (alias)
const saveCicloItens = salvarCiclo;

module.exports = {
  getQuantidadeCultos,
  getCicloItens,
  salvarCiclo,      
  saveCicloItens,   
  getOrganistasDaIgreja,
  getCicloComoListaOrganistas,
  getFilaMestra,
  getFilaMestraOficiais
};