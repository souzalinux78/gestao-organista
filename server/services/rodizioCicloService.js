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

const gerarRodizioComCiclos = async (igrejaId, periodoMeses, cicloInicialId, dataInicial, organistaInicialId) => {
  const pool = db.getDb();

  // 1. Fetch Configuration
  const [igrejas] = await pool.execute('SELECT * FROM igrejas WHERE id = ?', [igrejaId]);
  if (igrejas.length === 0) throw new Error('Igreja não encontrada');

  // Fetch Cultos
  const [cultos] = await pool.execute('SELECT * FROM cultos WHERE igreja_id = ? AND ativo = 1', [igrejaId]);

  // 2. Fetch Active Cycles sorted by Order
  const [ciclos] = await pool.execute('SELECT * FROM ciclos WHERE igreja_id = ? AND ativo = 1 ORDER BY ordem ASC', [igrejaId]);
  if (ciclos.length === 0) throw new Error('Nenhum ciclo ativo encontrado.');

  // 3. BUILD UNIFIED MASTER POOL
  // Load ALL active cycles and their items in order
  const masterItems = [];
  const cycleTypeMap = new Map(); // cycleId -> 'rjm' | 'official' | 'both'

  for (const ciclo of ciclos) {
    // Robust detection: look at both 'tipo' and 'eh_rjm' columns
    const isLinkedToOfficial = cultos.some(c => c.ciclo_id === ciclo.id && c.tipo === 'culto_oficial');
    const isLinkedToRJM = cultos.some(c => c.ciclo_id === ciclo.id && (c.tipo === 'rjm' || c.eh_rjm === 1));

    let type = 'none';
    if (isLinkedToOfficial && isLinkedToRJM) type = 'both';
    else if (isLinkedToOfficial) type = 'official';
    else if (isLinkedToRJM) type = 'rjm';

    cycleTypeMap.set(ciclo.id, type);

    const [cycleItems] = await pool.execute(`
        SELECT ci.organista_id as id, o.nome, o.categoria, ci.posicao, ci.ciclo_id, ? as cycle_type
        FROM ciclo_itens ci
        JOIN organistas o ON ci.organista_id = o.id
        WHERE ci.ciclo_id = ? AND o.ativa = 1
        ORDER BY ci.posicao ASC
    `, [type, ciclo.id]);

    masterItems.push(...cycleItems);
  }

  if (masterItems.length === 0) throw new Error('Nenhum item de ciclo encontrado.');

  // Create virtual expansion for cycles (circular buffer)
  const masterPool = [];
  for (let i = 0; i < 50; i++) { // Enough expansion for long periods
    masterPool.push(...masterItems.map(x => ({ ...x, uuid: `${x.id}_${i}_${Math.random()}` })));
  }

  // 4. Initial Pointers (Senior Refactor: Robust forced starting baseline)
  const pointers = {
    official: 0,
    rjm: 0
  };

  if (cicloInicialId || organistaInicialId) {
    let searchIdx = -1;

    console.log(`[RODIZIO] Iniciando busca STRICT: Ciclo=${cicloInicialId}, OrganistaID=${organistaInicialId}`);

    if (cicloInicialId && organistaInicialId) {
      // 1. Precise Match: Same ID and Same Cycle
      searchIdx = masterPool.findIndex(i => String(i.id) == String(organistaInicialId) && String(i.ciclo_id) == String(cicloInicialId));

      if (searchIdx === -1) {
        // 2. Name Fallback: Same Name in the requested Cycle (handles ID mismatches)
        const targetOrg = masterPool.find(i => String(i.id) == String(organistaInicialId));
        if (targetOrg) {
          searchIdx = masterPool.findIndex(i => i.nome === targetOrg.nome && String(i.ciclo_id) == String(cicloInicialId));
        }
      }

      if (searchIdx === -1) {
        // 3. Cycle Fallback: If organist not found in cycle, just start at beginning of cycle
        searchIdx = masterPool.findIndex(i => String(i.ciclo_id) == String(cicloInicialId));
        console.warn(`[RODIZIO] Organista não encontrado no ciclo ${cicloInicialId}. Iniciando no topo do ciclo.`);
      }
    } else if (cicloInicialId) {
      // Start at first organist of specific cycle
      searchIdx = masterPool.findIndex(i => String(i.ciclo_id) == String(cicloInicialId));
    } else if (organistaInicialId) {
      // Start at first occurrence of specific organist (any cycle)
      searchIdx = masterPool.findIndex(i => String(i.id) == String(organistaInicialId));
    }

    if (searchIdx !== -1) {
      console.log(`[RODIZIO] Ponto de partida definido: Índice ${searchIdx} (Organista: ${masterPool[searchIdx].nome}, Ciclo: ${masterPool[searchIdx].ciclo_id})`);
      pointers.official = searchIdx;
      pointers.rjm = searchIdx;
    } else {
      console.warn(`[RODIZIO] AVISO: Ponto de partida não encontrado. Usando início padrão (0).`);
    }
  }

  // 5. Generate Calendar
  const escala = [];
  const startPart = dataInicial.split('-');
  let currDate = new Date(startPart[0], startPart[1] - 1, startPart[2]);
  const endDate = new Date(currDate);
  endDate.setMonth(endDate.getMonth() + parseInt(periodoMeses));

  const diaMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

  while (currDate <= endDate) {
    const diaSemana = currDate.getDay();
    const diaStr = diaMap[diaSemana];

    // Filter cultos of the day
    const cultosDoDia = cultos.filter(c => normalizarDia(c.dia_semana).includes(normalizarDia(diaStr)));
    cultosDoDia.sort((a, b) => a.hora.localeCompare(b.hora));

    for (const culto of cultosDoDia) {
      // Robust service type detection
      const isRJMService = (culto.tipo === 'rjm' || culto.eh_rjm === 1);
      const isOfficialService = (culto.tipo === 'culto_oficial' && !isRJMService);
      const isThursday = (diaSemana === 4);

      // Determine pointer and compatibility filter
      const typeKey = isRJMService ? 'rjm' : 'official';

      // Helper to find next compatible candidate and move the specific pointer
      const consumeCandidate = (ptrKey, serviceType) => {
        let p = pointers[ptrKey];
        while (p < masterPool.length) {
          const item = masterPool[p];
          const cType = cycleTypeMap.get(item.ciclo_id);

          // COMPATIBILITY LOGIC:
          // Official Service uses 'official' or 'both' cycles.
          // RJM Service uses 'rjm' or 'both' cycles.
          const isCompatible = (serviceType === 'rjm')
            ? (cType === 'rjm' || cType === 'both')
            : (cType === 'official' || cType === 'both');

          if (isCompatible) {
            pointers[ptrKey] = p + 1; // Consume
            return { candidate: item, ptrUsed: p };
          }
          p++; // Skip incompatible
        }
        return { candidate: null, ptrUsed: p };
      };

      const { candidate, ptrUsed } = consumeCandidate(typeKey, typeKey);
      if (!candidate) continue;

      let orgMeia = null;
      let orgCulto = null;
      let ptr = ptrUsed;

      if (isRJMService) {
        // RJM Service: Only "Tocar Culto" exists ("não existe meia hora" per user)
        orgMeia = null;
        orgCulto = candidate;
      }
      else if (isOfficialService) {
        // CATEGORY RULES for CULTO OFICIAL:
        // Rule: Pupils (Aluna) and RJM category only play Meia Hora. 
        // Rule: The Culto role MUST ALWAYS be an Official.

        // Respect Church Setting: "Permitir que a mesma organista faça meia hora e tocar no culto"
        const permiteMesma = !!igrejas[0].mesma_organista_ambas_funcoes;

        if (ptr === 0) {
          console.log(`[RODIZIO] Iniciando geração para ${igrejas[0].nome}. Dobradinha permitida: ${permiteMesma}`);
        }

        if (permiteMesma || isThursday) {
          // One person does both. MUST BE OFFICIAL.
          if (candidate.categoria === 'oficial') {
            orgMeia = candidate;
            orgCulto = candidate;
          } else {
            // Candidate is Pupil/RJM. They can only do Meia Hora.
            // Split is mandatory here because Pupils can't play the Culto.
            let offset = 1;
            let foundIdx = -1;
            while (ptr + offset < masterPool.length) {
              if (masterPool[ptr + offset].categoria === 'oficial') {
                foundIdx = ptr + offset;
                break;
              }
              offset++;
            }

            if (foundIdx !== -1) {
              orgMeia = candidate;
              orgCulto = masterPool[foundIdx];

              // NOTE: In this unified multi-pointer model, the "found officer" used for split
              // should probably NOT be "consumed" from the pointer sequence for its next turn?
              // Or should it? 
              // Usually, if they accompany, they've worked.
              // For now, let's keep it simple: split roles use a helper search but don't 
              // necessarily advance the GLOBAL pointer of other types.

              // We advance current pool pointer to bypass the official we just used if it was close?
              // To avoid double-scaling the same official too soon.
              if (foundIdx === pointers[typeKey]) {
                pointers[typeKey]++;
              }
            } else {
              // No officials left? Extremely rare.
              orgMeia = candidate;
              orgCulto = null;
            }
          }
        } else {
          // Weekend/Standard Split (permiteMesma is OFF):
          // Meia Hora: current candidate (Official, Aluna or RJM)
          orgMeia = candidate;

          // Culto Role: MUST BE OFFICIAL
          let offset = 1;
          let foundIdx = -1;
          while (ptr + offset < masterPool.length) {
            const item = masterPool[ptr + offset];
            const cType = cycleTypeMap.get(item.ciclo_id);
            if ((cType === 'official' || cType === 'both') && item.categoria === 'oficial') {
              foundIdx = ptr + offset;
              break;
            }
            offset++;
          }

          if (foundIdx !== -1) {
            orgCulto = masterPool[foundIdx];
            if (foundIdx === pointers[typeKey]) {
              pointers[typeKey]++;
            }
          } else {
            // No officials for Culto role
            orgCulto = null;
          }
        }
      }

      // Push to Escala
      if (orgMeia) {
        escala.push({
          igreja_id: igrejaId,
          culto_id: culto.id,
          organista_id: orgMeia.id,
          data_culto: formatarData(currDate),
          hora_culto: calcularHoraMeiaHora(culto.hora),
          dia_semana: diaMap[diaSemana],
          funcao: 'meia_hora',
          periodo_inicio: dataInicial,
          periodo_fim: formatarData(endDate),
          ciclo: orgMeia.ciclo_id
        });
      }
      if (orgCulto) {
        escala.push({
          igreja_id: igrejaId,
          culto_id: culto.id,
          organista_id: orgCulto.id,
          data_culto: formatarData(currDate),
          hora_culto: culto.hora,
          dia_semana: diaMap[diaSemana],
          funcao: 'tocar_culto',
          periodo_inicio: dataInicial,
          periodo_fim: formatarData(endDate),
          ciclo: orgCulto.ciclo_id
        });
      }
    } // end for cultos

    currDate.setDate(currDate.getDate() + 1);
  }

  // 6. Save
  if (escala.length > 0) {
    await rodizioRepository.inserirRodizios(escala);
  }

  return rodizioRepository.buscarRodiziosCompletos(igrejaId, dataInicial, formatarData(endDate));
};

module.exports = {
  gerarRodizioComCiclos,
  gerarPreviaEscala: async () => []
};