const db = require('../database/db');
const { getPesoDiaSemanaBr } = require('../utils/dateHelpers');
const { gerarRodizioComCiclos } = require('./rodizioCicloService');

/**
 * Gera rodízio para uma igreja no período informado.
 * Delega para a geração por ciclos (N cultos = N ciclos, fila mestra, regras de capacidade).
 */
const gerarRodizio = async (igrejaId, periodoMeses, cicloInicial = null, dataInicial = null, organistaInicial = null) => {
  const pool = db.getDb();

  const [igrejas] = await pool.execute('SELECT * FROM igrejas WHERE id = ?', [igrejaId]);
  if (igrejas.length === 0) throw new Error('Igreja não encontrada');

  const [cultosRaw] = await pool.execute(
    'SELECT * FROM cultos WHERE igreja_id = ? AND ativo = 1',
    [igrejaId]
  );
  const cultos = cultosRaw.sort((a, b) => {
    const pesoA = getPesoDiaSemanaBr(a.dia_semana);
    const pesoB = getPesoDiaSemanaBr(b.dia_semana);
    return pesoA !== pesoB ? pesoA - pesoB : (a.hora || '').localeCompare(b.hora || '');
  });
  if (cultos.length === 0) throw new Error('Nenhum culto ativo encontrado para esta igreja');

  return await gerarRodizioComCiclos(igrejaId, periodoMeses, cicloInicial, dataInicial, organistaInicial);
};

module.exports = {
  gerarRodizio
};
