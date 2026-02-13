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

  // 2. LOAD CYCLES BY EXPLICIT TYPE (Using tipo column from DB)
  const [ciclosOficiais] = await pool.execute(
    'SELECT * FROM ciclos WHERE igreja_id = ? AND tipo = "oficial" AND ativo = 1 ORDER BY numero ASC',
    [igrejaId]
  );

  const [ciclosRJM] = await pool.execute(
    'SELECT * FROM ciclos WHERE igreja_id = ? AND tipo = "rjm" AND ativo = 1 ORDER BY ordem ASC',
    [igrejaId]
  );

  if (ciclosOficiais.length === 0 && ciclosRJM.length === 0) {
    throw new Error('Nenhum ciclo ativo encontrado.');
  }

  // 3. BUILD MASTER POOL - SEPARATED BY TYPE
  const masterItems = [];
  const cycleTypeMap = new Map(); // cycleId -> tipo from DB

  // Load Official Cycles (ordered by numero)
  for (const ciclo of ciclosOficiais) {
    cycleTypeMap.set(ciclo.id, 'oficial');

    const [cycleItems] = await pool.execute(`
        SELECT ci.organista_id as id, o.nome, o.categoria, ci.posicao, ci.ciclo_id, 
               'oficial' as cycle_type, ? as cycle_numero, ? as cycle_nome
        FROM ciclo_itens ci
        JOIN organistas o ON ci.organista_id = o.id
        WHERE ci.ciclo_id = ? AND o.ativa = 1
        ORDER BY ci.posicao ASC
    `, [ciclo.numero, ciclo.nome, ciclo.id]);

    if (cycleItems.length > 0) {
      console.log(`[RODIZIO] 📘 Ciclo Oficial ${ciclo.numero} "${ciclo.nome}" - ${cycleItems.length} organista(s)`);
    }

    masterItems.push(...cycleItems);
  }

  // Load RJM Cycles
  for (const ciclo of ciclosRJM) {
    cycleTypeMap.set(ciclo.id, 'rjm');

    const [cycleItems] = await pool.execute(`
        SELECT ci.organista_id as id, o.nome, o.categoria, ci.posicao, ci.ciclo_id, 
               'rjm' as cycle_type, NULL as cycle_numero, ? as cycle_nome
        FROM ciclo_itens ci
        JOIN organistas o ON ci.organista_id = o.id
        WHERE ci.ciclo_id = ? AND o.ativa = 1
        ORDER BY ci.posicao ASC
    `, [ciclo.nome, ciclo.id]);

    if (cycleItems.length > 0) {
      console.log(`[RODIZIO] 🎵 Ciclo RJM "${ciclo.nome}" - ${cycleItems.length} organista(s)`);
    }

    masterItems.push(...cycleItems);
  }

  if (masterItems.length === 0) throw new Error('Nenhum item de ciclo encontrado. Verifique se há organistas nos ciclos.');

  console.log(`[RODIZIO] Total: ${ciclosOficiais.length} ciclo(s) oficial(is), ${ciclosRJM.length} ciclo(s) RJM`);

  // LOG FINAL MASTER POOL ORDER
  console.log('[RODIZIO] Fila Mestra Final:', masterItems.map(i => i.nome).join(' -> '));

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

  const consumedIndices = new Set();

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
          // Rule 0: STRICT ORDER - If this index was already consumed (by a lookahead), SKIP IT.
          if (consumedIndices.has(p)) {
            p++;
            continue;
          }

          const item = masterPool[p];
          const cType = cycleTypeMap.get(item.ciclo_id);

          // COMPATIBILITY LOGIC (Cycle Type):
          // Now simple: RJM services use only 'rjm' cycles, Official use only 'oficial' cycles
          let isCycleCompatible = false;
          if (serviceType === 'rjm') {
            isCycleCompatible = (cType === 'rjm');
          } else {
            // Official Service
            isCycleCompatible = (cType === 'oficial');
          }

          // COMPATIBILITY LOGIC (Organist Category):
          let isCategoryCompatible = true;
          if (serviceType === 'rjm' && item.categoria === 'oficial') {
            const hasPermission = (item.permite_rjm === 1 || item.permite_rjm === true);
            if (!hasPermission) {
              isCategoryCompatible = false;
            }
          }

          if (isCycleCompatible && isCategoryCompatible) {
            pointers[ptrKey] = p + 1; // Advance pointer past this one
            consumedIndices.add(p);   // MARK AS CONSUMED
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
        // RJM Service: Only "Tocar Culto" exists
        orgMeia = null;
        orgCulto = candidate;
      }
      else if (isOfficialService) {
        // ... (Rule comments) ...
        const permiteMesma = !!igrejas[0].mesma_organista_ambas_funcoes;

        if (ptr === 0) {
          console.log(`[RODIZIO] Iniciando para ${igrejas[0].nome}. Dobradinha: ${permiteMesma}`);
        }

        if (permiteMesma || isThursday) {
          if (candidate.categoria === 'oficial') {
            orgMeia = candidate;
            orgCulto = candidate;
          } else {
            // Split mandatory: Aluna/RJM does Meia, Find next Official for Culto
            let offset = 1;
            let foundIdx = -1;
            while (ptr + offset < masterPool.length) {
              const idx = ptr + offset;
              // Rule 0 Check for Lookahead
              if (consumedIndices.has(idx)) {
                offset++;
                continue;
              }

              if (masterPool[idx].categoria === 'oficial') {
                foundIdx = idx;
                break;
              }
              offset++;
            }

            if (foundIdx !== -1) {
              orgMeia = candidate;
              orgCulto = masterPool[foundIdx];
              consumedIndices.add(foundIdx); // MARK AS CONSUMED
            } else {
              orgMeia = candidate;
              orgCulto = null;
            }
          }
        } else {
          // Standard Split (Weekend)
          orgMeia = candidate;

          // Find next Official for Culto
          let offset = 1;
          let foundIdx = -1;
          while (ptr + offset < masterPool.length) {
            const idx = ptr + offset;

            // Rule 0 Check for Lookahead
            if (consumedIndices.has(idx)) {
              offset++;
              continue;
            }

            const item = masterPool[idx];
            const cType = cycleTypeMap.get(item.ciclo_id);
            if ((cType === 'official' || cType === 'both') && item.categoria === 'oficial') {
              foundIdx = idx;
              break;
            }
            offset++;
          }

          if (foundIdx !== -1) {
            orgCulto = masterPool[foundIdx];
            consumedIndices.add(foundIdx); // MARK AS CONSUMED
          } else {
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
          ciclo: orgMeia.ciclo_id,
          ciclo_origem: orgMeia.ciclo_id
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
          ciclo: orgCulto.ciclo_id,
          ciclo_origem: orgCulto.ciclo_id
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