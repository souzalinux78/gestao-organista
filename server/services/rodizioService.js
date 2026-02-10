const db = require('../database/db');
const { getProximaData, adicionarMeses, formatarData, calcularHoraMeiaHora, getPesoDiaSemanaBr } = require('../utils/dateHelpers');
const rodizioRepository = require('./rodizioRepository');
const { gerarRodizioComCiclos } = require('./rodizioCicloService');

// Função para verificar se organista tocou nos últimos X dias (evitar sequências)
// Verifica se tocou nos últimos 7 dias para evitar cultos muito próximos
const organistaTocouNosUltimosDias = (organistaId, dataAtual, rodiziosExistentes, diasVerificar = 7) => {
  const dataLimite = new Date(dataAtual);
  dataLimite.setDate(dataLimite.getDate() - diasVerificar);
  
  return rodiziosExistentes.some(r => {
    const dataRodizio = new Date(r.data_culto);
    return r.organista_id === organistaId && 
           dataRodizio >= dataLimite && 
           dataRodizio < dataAtual;
  });
};

// Função para verificar se organista tocou dentro do intervalo mínimo de dias
const organistaTocouDentroDoIntervaloMinimo = (organistaId, dataAtual, rodiziosExistentes, diasMinimos = 7) => {
  return rodiziosExistentes.some(r => {
    if (r.organista_id !== organistaId) return false;
    
    const dataRodizio = new Date(r.data_culto);
    const diferencaDias = Math.abs((dataAtual - dataRodizio) / (1000 * 60 * 60 * 24));
    
    // Se tocou em um culto dentro dos dias mínimos (antes ou depois), evitar
    return diferencaDias < diasMinimos && diferencaDias > 0;
  });
};

// Função para verificar se organista tocou no mesmo dia da semana recentemente
const organistaTocouNoMesmoDiaSemana = (organistaId, diaSemana, rodiziosExistentes) => {
  return rodiziosExistentes.some(r => 
    r.organista_id === organistaId && 
    r.dia_semana.toLowerCase() === diaSemana.toLowerCase()
  );
};

// Função para contar quantas vezes cada organista tocou em cada dia da semana
const contarTocadasPorDiaSemana = (organistas, rodiziosExistentes) => {
  const contadores = {};
  
  organistas.forEach(o => {
    contadores[o.id] = {};
    // Inicializar contadores para cada dia da semana
    ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'].forEach(dia => {
      contadores[o.id][dia] = 0;
    });
  });
  
  rodiziosExistentes.forEach(r => {
    if (contadores[r.organista_id] && r.dia_semana) {
      const dia = r.dia_semana.toLowerCase();
      contadores[r.organista_id][dia] = (contadores[r.organista_id][dia] || 0) + 1;
    }
  });
  
  return contadores;
};

// Função para verificar se organista sempre faz a mesma função (verifica desequilíbrio)
const organistaSempreMesmaFuncao = (organistaId, funcao, rodiziosExistentes) => {
  const rodiziosOrganista = rodiziosExistentes.filter(r => r.organista_id === organistaId);
  
  if (rodiziosOrganista.length < 3) return false;
  
  // Contar quantas vezes fez cada função
  const meiaHora = rodiziosOrganista.filter(r => r.funcao === 'meia_hora').length;
  const tocarCulto = rodiziosOrganista.filter(r => r.funcao === 'tocar_culto').length;
  
  // Se a diferença for maior que 2, está desequilibrado
  const diferenca = Math.abs(meiaHora - tocarCulto);
  
  // Se está tentando atribuir a função que ela já fez muito mais vezes, evitar
  if (funcao === 'meia_hora' && meiaHora > tocarCulto + 1) return true;
  if (funcao === 'tocar_culto' && tocarCulto > meiaHora + 1) return true;
  
  return false;
};

// Função para distribuir organistas de forma equilibrada
const distribuirOrganistas = (organistas, rodiziosExistentes, dataAtual, funcao, diaSemana) => {
  // Criar contadores de quantas vezes cada organista já tocou em cada função
  const contadoresMeiaHora = {};
  const contadoresTocarCulto = {};
  const contadoresTotal = {};
  
  organistas.forEach(o => {
    contadoresMeiaHora[o.id] = rodiziosExistentes.filter(r => 
      r.organista_id === o.id && r.funcao === 'meia_hora'
    ).length;
    
    contadoresTocarCulto[o.id] = rodiziosExistentes.filter(r => 
      r.organista_id === o.id && r.funcao === 'tocar_culto'
    ).length;
    
    contadoresTotal[o.id] = rodiziosExistentes.filter(r => 
      r.organista_id === o.id
    ).length;
  });
  
  // Calcular desequilíbrio de funções para cada organista
  const desequilibrio = {};
  organistas.forEach(o => {
    const diferenca = Math.abs(contadoresMeiaHora[o.id] - contadoresTocarCulto[o.id]);
    desequilibrio[o.id] = diferenca;
  });
  
  // Contar quantas vezes cada organista tocou em cada dia da semana
  const contadoresPorDia = contarTocadasPorDiaSemana(organistas, rodiziosExistentes);
  const diaSemanaLower = diaSemana.toLowerCase();
  
  // Ordenar por:
  // PRIORIDADE MÁXIMA: Quem tocou MENOS vezes neste dia específico da semana (forçar rotação)
  // 1. Menor contador da função específica (prioridade: quem menos fez esta função)
  // 2. Menor desequilíbrio (priorizar quem tem funções mais equilibradas)
  // 3. Penalizar quem sempre faz a mesma função
  // 4. Menor contador total (garantir que todas toquem igualmente)
  // 5. Quem não tocou muito recentemente (evitar cultos seguidos)
  // 6. Ordem de cadastro (menor ID = mais antiga)
  const organistasOrdenadas = [...organistas].sort((a, b) => {
    // PRIORIDADE MÁXIMA: Organistas que tocaram MENOS vezes neste dia específico
    const contadorDiaA = contadoresPorDia[a.id]?.[diaSemanaLower] || 0;
    const contadorDiaB = contadoresPorDia[b.id]?.[diaSemanaLower] || 0;
    
    if (contadorDiaA !== contadorDiaB) {
      return contadorDiaA - contadorDiaB; // Priorizar quem tocou menos vezes neste dia
    }
    
    // Se ambas tocaram ou não tocaram no mesmo dia, continuar com outras prioridades
    const contadorFuncaoA = funcao === 'meia_hora' ? contadoresMeiaHora[a.id] : contadoresTocarCulto[a.id];
    const contadorFuncaoB = funcao === 'meia_hora' ? contadoresMeiaHora[b.id] : contadoresTocarCulto[b.id];
    
    // Prioridade 1: Menor contador da função específica
    const diffFuncao = contadorFuncaoA - contadorFuncaoB;
    if (diffFuncao !== 0) return diffFuncao;
    
    // Prioridade 2: Menor desequilíbrio (quem tem funções mais equilibradas)
    const diffDesequilibrio = desequilibrio[a.id] - desequilibrio[b.id];
    if (diffDesequilibrio !== 0) return diffDesequilibrio;
    
    // Prioridade 3: Penalizar quem sempre faz a mesma função
    const aSempreMesma = organistaSempreMesmaFuncao(a.id, funcao, rodiziosExistentes);
    const bSempreMesma = organistaSempreMesmaFuncao(b.id, funcao, rodiziosExistentes);
    
    if (aSempreMesma && !bSempreMesma) return 1; // A sempre faz, B não - priorizar B
    if (!aSempreMesma && bSempreMesma) return -1; // B sempre faz, A não - priorizar A
    
    // Prioridade 4: Menor contador total (garantir que todas toquem igualmente)
    const diffTotal = contadoresTotal[a.id] - contadoresTotal[b.id];
    if (diffTotal !== 0) return diffTotal;
    
    // Prioridade 5: Verificar se tocou muito recentemente (evitar cultos seguidos)
    const aTocouMuitoProximo = organistaTocouDentroDoIntervaloMinimo(a.id, dataAtual, rodiziosExistentes, 7);
    const bTocouMuitoProximo = organistaTocouDentroDoIntervaloMinimo(b.id, dataAtual, rodiziosExistentes, 7);
    
    if (aTocouMuitoProximo && !bTocouMuitoProximo) return 1;
    if (!aTocouMuitoProximo && bTocouMuitoProximo) return -1;
    
    // Prioridade 6: Ordem de cadastro (menor ID = mais antiga)
    return a.id - b.id;
  });
  
  // Retornar a primeira que:
  // 1. Não está escalada para outra função no mesmo culto (OBRIGATÓRIO)
  // 2. Respeitar a ordem da lista passada (primeira prioridade - lista já vem ordenada por quem tocou menos neste dia)
  // 3. Priorizar quem menos fez esta função específica
  // 3. Priorizar quem menos tocou no total (garantir distribuição)
  
  // Primeiro, filtrar organistas que:
  // 1. Já estão escaladas para outra função no mesmo culto
  // 2. Tocararam muito recentemente (evitar cultos seguidos)
  const organistasDisponiveis = organistasOrdenadas.filter(organista => {
    const jaEscaladaOutraFuncao = rodiziosExistentes.some(r => 
      r.organista_id === organista.id && 
      r.data_culto === formatarData(dataAtual) &&
      r.funcao !== funcao
    );
    
    const tocouMuitoProximo = organistaTocouDentroDoIntervaloMinimo(organista.id, dataAtual, rodiziosExistentes, 7);
    
    return !jaEscaladaOutraFuncao && !tocouMuitoProximo;
  });
  
  // Se não há organistas disponíveis (todas já escaladas ou tocaram recentemente), 
  // usar as que não estão escaladas para outra função (mesmo que tenham tocado recentemente)
  if (organistasDisponiveis.length === 0) {
    const organistasNaoEscaladas = organistasOrdenadas.filter(organista => {
      const jaEscaladaOutraFuncao = rodiziosExistentes.some(r => 
        r.organista_id === organista.id && 
        r.data_culto === formatarData(dataAtual) &&
        r.funcao !== funcao
      );
      return !jaEscaladaOutraFuncao;
    });
    
    if (organistasNaoEscaladas.length > 0) {
      return organistasNaoEscaladas[0];
    }
    
    // Último recurso: retornar a primeira da lista original
    return organistasOrdenadas[0];
  }
  
  // Retornar a primeira disponível (já está ordenada por quem menos fez)
  return organistasDisponiveis[0];
};

const ordemBaseOrganistas = (organistas) => {
  // Preferir a numeração (ordem de organistas_igreja). Se não tiver, cair no ID (mais antigo primeiro).
  // A ordem agora vem de organistas_igreja, não de organistas
  const comOrdem = organistas
    .filter(o => {
      // Ordem pode vir como ordem ou associacao_ordem (dependendo da query)
      const ordem = o.ordem !== undefined ? o.ordem : (o.associacao_ordem !== undefined ? o.associacao_ordem : null);
      return ordem !== null && ordem !== undefined;
    })
    .sort((a, b) => {
      const ordemA = a.ordem !== undefined ? a.ordem : (a.associacao_ordem !== undefined ? a.associacao_ordem : null);
      const ordemB = b.ordem !== undefined ? b.ordem : (b.associacao_ordem !== undefined ? b.associacao_ordem : null);
      return ordemA - ordemB;
    });

  const semOrdem = organistas
    .filter(o => {
      const ordem = o.ordem !== undefined ? o.ordem : (o.associacao_ordem !== undefined ? o.associacao_ordem : null);
      return ordem === null || ordem === undefined;
    })
    .sort((a, b) => a.id - b.id);

  return [...comOrdem, ...semOrdem];
};

// Regra pedida: ciclo 0 = [1..N], ciclo 1 = reverse(2 primeiros), ciclo 2 = reverse(3 primeiros), ...
const aplicarCicloOrdem = (lista, ciclo) => {
  const n = lista.length;
  if (n <= 1) return lista;
  const k = (ciclo % n) + 1; // 1..n
  const prefixo = lista.slice(0, k).reverse();
  return [...prefixo, ...lista.slice(k)];
};

const isOficializadaParaCulto = (o) => {
  // “Oficializada” precisa estar true na organista.
  // (Se no futuro quiser usar a associação, dá pra incluir associacao_oficializada aqui.)
  return o.oficializada === 1 || o.oficializada === true;
};

const gerarRodizio = async (igrejaId, periodoMeses, cicloInicial = null, dataInicial = null, organistaInicial = null) => {
  const pool = db.getDb();

  try {
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

    // Usar geração por Ciclos (N cultos = N ciclos, rotação semanal, regras capacidade e anti-burnout)
    return await gerarRodizioComCiclos(igrejaId, periodoMeses, cicloInicial, dataInicial, organistaInicial);
  } catch (error) {
    throw error;
  }
};

// Lógica legada mantida para referência (não usada quando gerarRodizioComCiclos está ativo)
const _gerarRodizioLegado = async (igrejaId, periodoMeses, cicloInicial = null, dataInicial = null, organistaInicial = null) => {
  const pool = db.getDb();

  try {
    const [igrejas] = await pool.execute('SELECT * FROM igrejas WHERE id = ?', [igrejaId]);
    if (igrejas.length === 0) throw new Error('Igreja não encontrada');
    const igreja = igrejas[0];
    const permiteMesmaOrganista = igreja.mesma_organista_ambas_funcoes === 1;

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

    const [organistasRaw] = await pool.execute(
      `SELECT o.*, 
              oi.oficializada as associacao_oficializada,
              oi.ordem as associacao_ordem
       FROM organistas o
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
       WHERE oi.igreja_id = ?
         AND o.ativa = 1
       ORDER BY (oi.ordem IS NULL), oi.ordem ASC, oi.id ASC`,
      [igrejaId]
    );
    
    if (organistasRaw.length === 0) {
      throw new Error('Nenhuma organista ativa associada a esta igreja');
    }
    
    const diasCulto = cultos.map(c => c.dia_semana.toLowerCase());
    const organistas = organistasRaw.map(o => ({
      id: o.id,
      nome: o.nome,
      oficializada: o.associacao_oficializada === 1 || o.oficializada === 1
    }));
    
    const totalDias = diasCulto.length;
    const totalOrganistas = organistas.length;
    
    // cicloInicial vem da UI como 1 ou 2 (1-based)
    // A função gerarOrdemCiclo implementa:
    // - Ciclo 1 = ordem normal: [1, 2, 3, 4, 5, 6]
    // - Ciclo 2 = inverter pares: [2, 1, 4, 3, 6, 5]
    // - Ciclos seguintes alternam entre 1 e 2
    let cicloAtual = cicloInicial !== null && cicloInicial !== undefined 
      ? cicloInicial 
      : Number(igreja.rodizio_ciclo || 1);
    
    // Garantir que o ciclo seja pelo menos 1
    if (cicloAtual < 1) {
      cicloAtual = 1;
    }
    
    const gerarOrdemCiclo = (ciclo, totalDias, totalOrganistas) => {
      // Criar lista base de índices [0, 1, 2, ..., totalOrganistas-1]
      // Representa organistas: 1, 2, 3, 4, 5, 6 (índices 0, 1, 2, 3, 4, 5)
      const ordem = [];
      for (let i = 0; i < totalOrganistas; i++) {
        ordem.push(i);
      }
      
      // Ciclo 1 = ordem normal: [0, 1, 2, 3, 4, 5] = organistas 1, 2, 3, 4, 5, 6
      // Ciclo 2 = inverter pares consecutivos: [1, 0, 3, 2, 5, 4] = organistas 2, 1, 4, 3, 6, 5
      
      // Ciclo 0 ou 1 = ordem normal (sem inversão)
      if (ciclo === 0 || ciclo === 1) {
        return ordem;
      }
      
      // Ciclo 2 = inverter pares consecutivos
      // Para cada par de organistas consecutivos, inverter a ordem
      // Exemplo: [0,1,2,3,4,5] -> [1,0,3,2,5,4]
      if (ciclo === 2) {
        const novaOrdem = [];
        for (let i = 0; i < totalOrganistas; i += 2) {
          if (i + 1 < totalOrganistas) {
            // Par completo: inverter [i, i+1] -> [i+1, i]
            novaOrdem.push(ordem[i + 1]);
            novaOrdem.push(ordem[i]);
          } else {
            // Organista ímpar no final: manter na mesma posição
            novaOrdem.push(ordem[i]);
          }
        }
        return novaOrdem;
      }
      
      // Para ciclos maiores que 2, alternar entre ciclo 1 e 2
      // Ciclo 3 = ciclo 1 (ordem normal)
      // Ciclo 4 = ciclo 2 (inverter pares)
      // Ciclo 5 = ciclo 1 (ordem normal)
      // etc.
      const cicloMod = ((ciclo - 1) % 2) + 1;
      
      if (cicloMod === 1) {
        return ordem; // Ciclo 1 = ordem normal
      } else {
        // Ciclo 2 = inverter pares
        const novaOrdem = [];
        for (let i = 0; i < totalOrganistas; i += 2) {
          if (i + 1 < totalOrganistas) {
            novaOrdem.push(ordem[i + 1]);
            novaOrdem.push(ordem[i]);
          } else {
            novaOrdem.push(ordem[i]);
          }
        }
        return novaOrdem;
      }
    };
    
    const dataInicio = dataInicial ? new Date(dataInicial) : new Date();
    const dataFim = adicionarMeses(dataInicio, periodoMeses);
    
    const todasDatas = [];
    for (const culto of cultos) {
      let dataAtual = getProximaData(culto.dia_semana, dataInicio);
      while (dataAtual <= dataFim) {
        const dataFormatada = formatarData(dataAtual);
        const existe = await rodizioRepository.existeRodizio(culto.id, dataFormatada);
        if (!existe) {
          todasDatas.push({
            culto: culto,
            data: new Date(dataAtual),
            dataFormatada: dataFormatada
          });
        }
        dataAtual = new Date(dataAtual);
        dataAtual.setDate(dataAtual.getDate() + 7);
      }
    }
    
    todasDatas.sort((a, b) => a.data - b.data);
    
    const novosRodizios = [];
    let indiceOrganista = organistaInicial !== null && organistaInicial >= 0 && organistaInicial < totalOrganistas 
      ? organistaInicial 
      : 0;
    
    for (const item of todasDatas) {
      const { culto, dataFormatada } = item;
      
      // CORREÇÃO: Removida lógica de alinhamento indevida que pulava datas
      // Agora processamos TODAS as datas geradas, respeitando apenas a ordem cronológica
      
      if (indiceOrganista >= totalOrganistas) {
        cicloAtual++;
        indiceOrganista = 0;
      }
      
      const ordemCiclo = gerarOrdemCiclo(cicloAtual, totalDias, totalOrganistas);
      const indiceReal = ordemCiclo[indiceOrganista];
      const organistaSelecionada = organistas[indiceReal];
      
      indiceOrganista++;
      
      let organistaMeiaHora, organistaTocarCulto;
      
      if (permiteMesmaOrganista) {
        // CORREÇÃO: Garantir que organista não oficializada nunca toque no culto
        if (!organistaSelecionada.oficializada) {
          // Organista não oficializada: buscar organista oficializada para ambas as funções
          const proximaOficializada = organistas.find(o => o.oficializada);
          if (!proximaOficializada) {
            throw new Error('Não existe organista oficializada ativa associada. Organistas não oficializadas só podem fazer meia hora.');
          }
          // Organista não oficializada faz meia hora, oficializada toca no culto
          organistaMeiaHora = organistaSelecionada; // Não oficializada faz meia hora
          organistaTocarCulto = proximaOficializada; // Oficializada toca no culto
        } else {
          // Organista oficializada pode fazer ambas as funções
          organistaMeiaHora = organistaSelecionada;
          organistaTocarCulto = organistaSelecionada;
        }
      } else {
        // CORREÇÃO: Organista não oficializada só pode fazer meia hora
        // Sempre buscar organista oficializada para tocar no culto
        organistaMeiaHora = organistaSelecionada;
        let organistaTocarCultoEncontrada = null;
        const indiceAnterior = indiceOrganista - 1;
        
        // Buscar próxima organista oficializada na sequência
        for (let i = 1; i < totalOrganistas; i++) {
          const idxProximo = (indiceAnterior + i) % totalOrganistas;
          const indiceRealProximo = ordemCiclo[idxProximo];
          const org = organistas[indiceRealProximo];
          if (org.oficializada) {
            organistaTocarCultoEncontrada = org;
            break;
          }
        }
        
        // Se não encontrou na sequência, buscar qualquer organista oficializada
        if (!organistaTocarCultoEncontrada) {
          organistaTocarCultoEncontrada = organistas.find(o => o.oficializada);
        }
        
        // VALIDAÇÃO CRÍTICA: Garantir que organistaTocarCulto seja sempre oficializada
        if (!organistaTocarCultoEncontrada || !organistaTocarCultoEncontrada.oficializada) {
          throw new Error('Não existe organista oficializada ativa associada para a função "Tocar no Culto". Organistas não oficializadas só podem fazer meia hora.');
        }
        
        organistaTocarCulto = organistaTocarCultoEncontrada;
      }
      
      const horaMeiaHora = calcularHoraMeiaHora(culto.hora);
      
      const rodizioMeiaHora = {
        igreja_id: igrejaId,
        culto_id: culto.id,
        organista_id: organistaMeiaHora.id,
        data_culto: dataFormatada,
        hora_culto: horaMeiaHora,
        dia_semana: culto.dia_semana,
        funcao: 'meia_hora',
        periodo_inicio: formatarData(dataInicio),
        periodo_fim: formatarData(dataFim)
      };
      
      const rodizioTocarCulto = {
        igreja_id: igrejaId,
        culto_id: culto.id,
        organista_id: organistaTocarCulto.id,
        data_culto: dataFormatada,
        hora_culto: culto.hora,
        dia_semana: culto.dia_semana,
        funcao: 'tocar_culto',
        periodo_inicio: formatarData(dataInicio),
        periodo_fim: formatarData(dataFim)
      };
      
      novosRodizios.push(rodizioMeiaHora);
      novosRodizios.push(rodizioTocarCulto);
    }
    
    if (novosRodizios.length > 0) {
      await rodizioRepository.inserirRodizios(novosRodizios);
      await pool.execute(
        'UPDATE igrejas SET rodizio_ciclo = ? WHERE id = ?',
        [cicloAtual, igrejaId]
      );
    }
    
    const rodiziosCompletos = await rodizioRepository.buscarRodiziosCompletos(
      igrejaId, 
      formatarData(dataInicio), 
      formatarData(dataFim)
    );
    
    return rodiziosCompletos;
  } catch (error) {
    throw error;
  }
};

// Funções inserirRodizios e buscarRodiziosCompletos foram movidas para rodizioRepository.js

module.exports = {
  gerarRodizio
};
