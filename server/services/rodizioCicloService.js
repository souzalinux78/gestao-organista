/**
 * RODÍZIO DE ORGANISTAS - V14 (LINEAR SEQUENCE FIX)
 * This version strictly follows the database order (C1 -> C2 -> C3).
 * It prevents "looping back" to Cycle 1 until all subsequent cycles are used.
 */

const db = require('../database/db');
const { formatarData, calcularHoraMeiaHora } = require('../utils/dateHelpers');
const rodizioRepository = require('./rodizioRepository');

const normalizarDia = (str) => {
  if (!str) return '';
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^\w\s]/gi, '')
    .replace('feira', '')
    .trim();
};

const trazerOficialParaPosicao = (fila, indiceAlvo) => {
    // Check safety
    if (indiceAlvo >= fila.length) return;

    if (fila[indiceAlvo].oficializada) return;

    let offset = 1;
    // Search forward in the linear queue
    while ((indiceAlvo + offset) < fila.length) {
        let idxCandidata = indiceAlvo + offset;
        if (fila[idxCandidata].oficializada) {
            // SWAP: The organist moves, carrying her specific Cycle ID with her
            let temp = fila[indiceAlvo];
            fila[indiceAlvo] = fila[idxCandidata];
            fila[idxCandidata] = temp;
            return;
        }
        offset++;
    }
};

const gerarRodizioComCiclos = async (igrejaId, periodoMeses, cicloInicial, dataInicial, organistaInicial) => {
  const pool = db.getDb();
  
  const [igrejas] = await pool.execute('SELECT * FROM igrejas WHERE id = ?', [igrejaId]);
  if (igrejas.length === 0) throw new Error('Igreja não encontrada');
  console.log(`>>> V14: GERANDO PARA ${igrejas[0].nome}`);

  // 1. FETCH DATA STRICTLY ORDERED BY CYCLE AND POSITION
  // This is the absolute source of truth.
  const [dbRows] = await pool.execute(
    `SELECT ci.organista_id as id, o.nome, ci.numero_ciclo as ciclo, ci.posicao,
            COALESCE(oi.oficializada, o.oficializada, 0) as oficializada
     FROM ciclo_itens ci
     INNER JOIN organistas o ON o.id = ci.organista_id
     LEFT JOIN organistas_igreja oi ON oi.organista_id = o.id AND oi.igreja_id = ci.igreja_id
     WHERE ci.igreja_id = ? 
     ORDER BY ci.numero_ciclo ASC, ci.posicao ASC`, 
    [igrejaId]
  );

  if (dbRows.length === 0) throw new Error('Ciclo vazio.');

  // 2. BUILD THE LINEAR TIMELINE
  // We don't just loop Cycle 1. We build C1 -> C2 -> C3 -> C1' -> C2' -> C3'...
  // This ensures that after C1-End comes C2-Start.
  
  let superFila = [];
  const maxCicloDB = Math.max(...dbRows.map(r => r.ciclo));
  
  // Create enough repetition to cover the time period (e.g., 10 repetitions of the full set)
  // If database has C1, C2, C3. 
  // Repetition 0: C1, C2, C3 (Exact database match)
  // Repetition 1: C1, C2, C3 (Virtual next cycles, we increment the cycle number visually if needed, 
  // or just repeat the pattern if the user just wants the flow).
  // *Based on your PDF requirements, it seems we stick to the DB cycle numbers.*
  
  for (let i = 0; i < 15; i++) { // Repeat the whole database sequence 15 times
      dbRows.forEach(row => {
          superFila.push({
              id: row.id,
              nome: row.nome,
              // If i > 0, we are repeating. 
              // If you want Cycle numbers to go 4, 5, 6... use: row.ciclo + (i * maxCicloDB)
              // If you want them to just repeat 1, 2, 3... use: row.ciclo
              // Based on your complaint "Silvana is first in Cycle 2", we stick to DB logic.
              ciclo: row.ciclo, 
              posicao: row.posicao,
              oficializada: (row.oficializada == 1),
              debug_origin: `DB_Rep_${i}` // For debugging
          });
      });
  }

  // 3. FIND STARTING POINT
  // We need to find the specific organist in the specific cycle requested.
  let ponteiro = 0;
  
  // Parse inputs
  let cicloStart = 1;
  if (cicloInicial) cicloStart = parseInt(String(cicloInicial).replace(/\D/g, '') || 1);
  
  let idStart = null;
  if (organistaInicial && !isNaN(organistaInicial)) idStart = parseInt(organistaInicial);

  console.log(`[BUSCA] Procurando ID: ${idStart} no Ciclo: ${cicloStart}`);

  let foundIndex = -1;

  if (idStart) {
      // Find the FIRST occurrence of this ID in the specific Cycle
      foundIndex = superFila.findIndex(item => item.id === idStart && item.ciclo === cicloStart);
  }

  // Fallback: If not found (maybe organist isn't in that cycle), find first occurrence in array
  if (foundIndex === -1 && idStart) {
      foundIndex = superFila.findIndex(item => item.id === idStart);
  }

  if (foundIndex !== -1) {
      ponteiro = foundIndex;
      console.log(`[SUCESSO] Início: ${superFila[ponteiro].nome} (Ciclo ${superFila[ponteiro].ciclo}) Index: ${ponteiro}`);
      
      // DEBUG: Peek at next person
      let next = superFila[ponteiro + 1];
      console.log(`[DEBUG] Próxima da fila será: ${next ? next.nome : 'Fim'} (Ciclo ${next ? next.ciclo : '-'})`);
  } else {
      console.log(`[ERRO] Não achou organista inicial. Começando do zero.`);
  }

  // 4. GENERATE CALENDAR
  const partesData = dataInicial.split('-'); 
  const dataAtual = new Date(partesData[0], partesData[1] - 1, partesData[2], 12, 0, 0);
  const dataFim = new Date(dataAtual);
  dataFim.setMonth(dataFim.getMonth() + parseInt(periodoMeses, 10));

  const escalaTemporaria = [];

  while (dataAtual <= dataFim) {
    const diaSemana = dataAtual.getDay(); 
    if (diaSemana === 0 || diaSemana === 4 || diaSemana === 6) {
      const dataFormatada = formatarData(dataAtual); 
      const nomeDia = diaSemana === 0 ? 'domingo' : (diaSemana === 4 ? 'quinta' : 'sabado');
      const horario = diaSemana === 0 ? '18:30' : '19:30';

      if (ponteiro >= superFila.length) break; // Safety break

      let orgMeiaHora = null;
      let orgCulto = null;
      
      // Get Candidate
      let candidata = superFila[ponteiro];

      // LOGIC: THURSDAY (Always Official Dobradinha)
      if (diaSemana === 4) {
          if (!candidata.oficializada) {
              trazerOficialParaPosicao(superFila, ponteiro);
              candidata = superFila[ponteiro]; // Refresh after swap
          }
          orgMeiaHora = candidata;
          orgCulto = candidata;
          ponteiro++;
      }
      // LOGIC: WEEKEND
      else {
          if (candidata.oficializada) {
              // Official -> Dobradinha
              orgMeiaHora = candidata;
              orgCulto = candidata;
              ponteiro++;
          } else {
              // Student -> Split
              orgMeiaHora = candidata;
              
              // Find Official for Culto
              trazerOficialParaPosicao(superFila, ponteiro + 1);
              let oficialParaCulto = superFila[ponteiro + 1];
              
              orgCulto = oficialParaCulto;
              ponteiro += 2; 
          }
      }

      escalaTemporaria.push({ data: dataFormatada, dia: nomeDia, hora: horario, funcao: 'Meia Hora', organista: orgMeiaHora });
      escalaTemporaria.push({ data: dataFormatada, dia: nomeDia, hora: horario, funcao: 'Tocar no Culto', organista: orgCulto });
    }
    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  // 5. SAVE TO DB
  const [cultosDb] = await pool.execute('SELECT id, dia_semana, hora FROM cultos WHERE igreja_id = ? AND ativo = 1', [igrejaId]);
  const novosRodizios = [];
  const periodoInicio = dataInicial;
  const periodoFimStr = formatarData(dataFim);

  for (const item of escalaTemporaria) {
    if (!item.organista) continue;

    const cultoCorrespondente = cultosDb.find(c => 
       normalizarDia(c.dia_semana).includes(normalizarDia(item.dia)) ||
       normalizarDia(item.dia).includes(normalizarDia(c.dia_semana))
    );

    if (!cultoCorrespondente) continue; 

    const funcaoDb = item.funcao === 'Meia Hora' ? 'meia_hora' : 'tocar_culto';
    const exists = await rodizioRepository.existeRodizio(cultoCorrespondente.id, item.data, funcaoDb);
    if (exists) continue;

    const horaDb = cultoCorrespondente.hora ? String(cultoCorrespondente.hora).slice(0, 8) : item.hora;
    const horaMeiaHora = calcularHoraMeiaHora(horaDb);

    novosRodizios.push({
      igreja_id: igrejaId,
      culto_id: cultoCorrespondente.id,
      organista_id: item.organista.id,
      data_culto: item.data,
      hora_culto: item.funcao === 'Meia Hora' ? horaMeiaHora : horaDb,
      dia_semana: item.dia,
      funcao: funcaoDb,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFimStr,
      ciclo: item.organista.ciclo // Save the cycle attached to the object from the linear queue
    });
  }

  if (novosRodizios.length > 0) {
    await rodizioRepository.inserirRodizios(novosRodizios);
  }

  return rodizioRepository.buscarRodiziosCompletos(igrejaId, periodoInicio, periodoFimStr);
};

module.exports = {
  gerarRodizioComCiclos,
  // Placeholders
  gerarPreviaEscala: async () => [],
  formatarCultoNome: () => '',
  CicloIterator: class {},
  ordenarCultosPorSlot: () => {},
  cultoNaoPermiteAlunas: () => {},
  organistaEmDiaConsecutivo: () => {},
  carregarPonteirosPorCiclo: async () => {},
  salvarPonteirosPorCiclo: async () => {}
};