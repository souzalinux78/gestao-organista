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

  // NEW APPROACH: Keep cycles separate, rotate entire cycles
  // Structure: { oficial: [{numero, items}], rjm: [{items}] }
  const cycleStructure = {
    oficial: ciclosOficiais.map(ciclo => {
      const items = masterItems.filter(item => item.ciclo_id === ciclo.id);
      return { numero: ciclo.numero, cicloId: ciclo.id, nome: ciclo.nome, items };
    }),
    rjm: ciclosRJM.map(ciclo => {
      const items = masterItems.filter(item => item.ciclo_id === ciclo.id);
      return { cicloId: ciclo.id, nome: ciclo.nome, items };
    })
  };

  // Remove empty cycles
  cycleStructure.oficial = cycleStructure.oficial.filter(c => c.items.length > 0);
  cycleStructure.rjm = cycleStructure.rjm.filter(c => c.items.length > 0);

  console.log('[RODIZIO] Estrutura de Ciclos:');
  cycleStructure.oficial.forEach(c => {
    console.log(`  📘 Ciclo ${c.numero}: ${c.items.length} organista(s) - ${c.items.map(i => i.nome).join(', ')}`);
  });
  cycleStructure.rjm.forEach(c => {
    console.log(`  🎵 Ciclo RJM: ${c.items.length} organista(s) - ${c.items.map(i => i.nome).join(', ')}`);
  });

  // 4. Initial Pointers: Determine starting cycle and organist
  let currentOfficialCycleIdx = 0;
  let currentOfficialItemIdx = 0;
  let currentRJMCycleIdx = 0;
  let currentRJMItemIdx = 0;

  if (cicloInicialId || organistaInicialId) {
    console.log(`[RODIZIO] Configurando início: Ciclo=${cicloInicialId}, Organista=${organistaInicialId}`);

    // Find cycle by ID or numero
    if (cicloInicialId) {
      const cycleIdx = cycleStructure.oficial.findIndex(c =>
        String(c.cicloId) === String(cicloInicialId) || String(c.numero) === String(cicloInicialId)
      );
      if (cycleIdx !== -1) {
        currentOfficialCycleIdx = cycleIdx;
        console.log(`[RODIZIO] Ciclo inicial definido: Ciclo ${cycleStructure.oficial[cycleIdx].numero}`);
      }
    }

    // Find organist within the selected cycle
    if (organistaInicialId && cycleStructure.oficial.length > 0) {
      const cycle = cycleStructure.oficial[currentOfficialCycleIdx];
      const itemIdx = cycle.items.findIndex(item => String(item.id) === String(organistaInicialId));
      if (itemIdx !== -1) {
        currentOfficialItemIdx = itemIdx;
        console.log(`[RODIZIO] Organista inicial: ${cycle.items[itemIdx].nome} (posição ${itemIdx + 1})`);
      } else {
        console.warn(`[RODIZIO] Organista ${organistaInicialId} não encontrado no ciclo. Iniciando do topo.`);
      }
    }
  }

  // 5. Generate Calendar
  const escala = [];
  const startPart = dataInicial.split('-');
  let currDate = new Date(startPart[0], startPart[1] - 1, startPart[2]);
  const endDate = new Date(currDate);
  endDate.setMonth(endDate.getMonth() + parseInt(periodoMeses));

  const diaMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

  // Helper: Get next organist from sequential cycles
  const getNextOfficialOrganist = () => {
    if (cycleStructure.oficial.length === 0) return null;

    const currentCycle = cycleStructure.oficial[currentOfficialCycleIdx];
    if (!currentCycle || currentCycle.items.length === 0) return null;

    // Get current organist
    const organist = currentCycle.items[currentOfficialItemIdx];

    // Advance pointer
    currentOfficialItemIdx++;

    // If reached end of current cycle, move to next cycle
    if (currentOfficialItemIdx >= currentCycle.items.length) {
      currentOfficialItemIdx = 0; // Reset to start of next cycle
      currentOfficialCycleIdx = (currentOfficialCycleIdx + 1) % cycleStructure.oficial.length; // Rotate to next cycle

      const nextCycle = cycleStructure.oficial[currentOfficialCycleIdx];
      console.log(`[RODIZIO] 🔄 Rotação: Ciclo ${currentCycle.numero} completo → Iniciando Ciclo ${nextCycle.numero}`);
    }

    return organist;
  };

  const getNextRJMOrganist = () => {
    if (cycleStructure.rjm.length === 0) return null;

    const currentCycle = cycleStructure.rjm[currentRJMCycleIdx];
    if (!currentCycle || currentCycle.items.length === 0) return null;

    const organist = currentCycle.items[currentRJMItemIdx];

    currentRJMItemIdx++;

    if (currentRJMItemIdx >= currentCycle.items.length) {
      currentRJMItemIdx = 0;
      currentRJMCycleIdx = (currentRJMCycleIdx + 1) % cycleStructure.rjm.length;
    }

    return organist;
  };

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

      let orgMeia = null;
      let orgCulto = null;

      if (isRJMService) {
        // RJM Service: Only "Tocar Culto" exists
        orgMeia = null;
        orgCulto = getNextRJMOrganist();
      }
      else if (isOfficialService) {
        const permiteMesma = !!igrejas[0].mesma_organista_ambas_funcoes;

        const candidate = getNextOfficialOrganist();
        if (!candidate) continue;

        if (permiteMesma || isThursday) {
          if (candidate.categoria === 'oficial') {
            orgMeia = candidate;
            orgCulto = candidate;
          } else {
            // Split mandatory: Aluna/RJM does Meia, Find next Official for Culto
            orgMeia = candidate;

            // Look ahead for next official in the CURRENT cycle structure
            // Save state before lookahead
            const savedCycleIdx = currentOfficialCycleIdx;
            const savedItemIdx = currentOfficialItemIdx;

            // Try to find next official organist
            let found = false;
            let lookaheadOrganist = null;
            const maxLookahead = 20; // Safety limit

            for (let i = 0; i < maxLookahead; i++) {
              const nextOrg = getNextOfficialOrganist();
              if (!nextOrg) break;

              if (nextOrg.categoria === 'oficial') {
                lookaheadOrganist = nextOrg;
                found = true;
                break;
              }
            }

            if (found) {
              orgCulto = lookaheadOrganist;
              // Pointers already advanced by getNextOfficialOrganist
            } else {
              // Restore state if not found
              currentOfficialCycleIdx = savedCycleIdx;
              currentOfficialItemIdx = savedItemIdx;
              orgCulto = null;
            }
          }
        } else {
          // Standard Split (Weekend): Aluna meia, próxima oficial culto
          orgMeia = candidate;

          // Similar lookahead logic
          const savedCycleIdx = currentOfficialCycleIdx;
          const savedItemIdx = currentOfficialItemIdx;

          let found = false;
          let lookaheadOrganist = null;
          const maxLookahead = 20;

          for (let i = 0; i < maxLookahead; i++) {
            const nextOrg = getNextOfficialOrganist();
            if (!nextOrg) break;

            if (nextOrg.categoria === 'oficial') {
              lookaheadOrganist = nextOrg;
              found = true;
              break;
            }
          }

          if (found) {
            orgCulto = lookaheadOrganist;
          } else {
            currentOfficialCycleIdx = savedCycleIdx;
            currentOfficialItemIdx = savedItemIdx;
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