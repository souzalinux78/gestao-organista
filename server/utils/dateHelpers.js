/**
 * Helpers para manipulação de datas e horários
 * Extraído de rodizioService.js para melhor organização
 */

const DIAS_SEMANA = {
  'domingo': 0,
  'segunda': 1,
  'terça': 2,
  'quarta': 3,
  'quinta': 4,
  'sexta': 5,
  'sábado': 6
};

/** Ordenação semana brasileira: Segunda = 1, Domingo = 7 (para sort de cultos/ciclos). */
const PESOS_DIA_SEMANA_BR = {
  'segunda': 1,
  'terça': 2, 'terca': 2,
  'quarta': 3,
  'quinta': 4,
  'sexta': 5,
  'sábado': 6, 'sabado': 6,
  'domingo': 7
};

function getPesoDiaSemanaBr(diaSemana) {
  if (!diaSemana) return 99;
  return PESOS_DIA_SEMANA_BR[String(diaSemana).toLowerCase().trim()] ?? 99;
}

/**
 * Obtém a próxima data de um dia da semana a partir de uma data inicial
 * @param {string} diaSemana - Nome do dia da semana (ex: 'segunda', 'quarta')
 * @param {Date|string} dataInicio - Data inicial
 * @returns {Date} Próxima data do dia da semana
 */
function getProximaData(diaSemana, dataInicio) {
  const diaNum = DIAS_SEMANA[diaSemana.toLowerCase()];
  if (diaNum === undefined) {
    throw new Error(`Dia da semana inválido: ${diaSemana}`);
  }
  
  const inicio = new Date(dataInicio);
  const diaAtual = inicio.getDay();
  let diasParaAdicionar = diaNum - diaAtual;
  
  if (diasParaAdicionar < 0) {
    diasParaAdicionar += 7;
  }
  
  const proximaData = new Date(inicio);
  proximaData.setDate(inicio.getDate() + diasParaAdicionar);
  
  return proximaData;
}

/**
 * Adiciona meses a uma data
 * @param {Date} data - Data base
 * @param {number} meses - Número de meses a adicionar
 * @returns {Date} Nova data com meses adicionados
 */
function adicionarMeses(data, meses) {
  const novaData = new Date(data);
  novaData.setMonth(novaData.getMonth() + meses);
  return novaData;
}

/**
 * Formata data como YYYY-MM-DD
 * @param {Date} data - Data a formatar
 * @returns {string} Data formatada
 */
function formatarData(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Calcula horário da meia hora (30 minutos antes do culto)
 * @param {string} horaCulto - Hora do culto no formato "HH:MM:SS" ou "HH:MM"
 * @returns {string} Hora formatada como "HH:MM:SS"
 */
function calcularHoraMeiaHora(horaCulto) {
  // horaCulto pode ser uma string "HH:MM:SS" ou "HH:MM"
  const [horas, minutos] = horaCulto.split(':').map(Number);
  
  // Subtrair 30 minutos
  let horaMeiaHora = horas;
  let minutoMeiaHora = minutos - 30;
  
  // Se minutos ficarem negativos, ajustar horas
  if (minutoMeiaHora < 0) {
    minutoMeiaHora += 60;
    horaMeiaHora -= 1;
  }
  
  // Formatar como "HH:MM:SS"
  return `${String(horaMeiaHora).padStart(2, '0')}:${String(minutoMeiaHora).padStart(2, '0')}:00`;
}

module.exports = {
  getProximaData,
  adicionarMeses,
  formatarData,
  calcularHoraMeiaHora,
  DIAS_SEMANA,
  PESOS_DIA_SEMANA_BR,
  getPesoDiaSemanaBr
};
