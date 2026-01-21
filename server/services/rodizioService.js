const db = require('../database/db');

const DIAS_SEMANA = {
  'domingo': 0,
  'segunda': 1,
  'terça': 2,
  'quarta': 3,
  'quinta': 4,
  'sexta': 5,
  'sábado': 6
};

// Função para obter próxima data de um dia da semana
const getProximaData = (diaSemana, dataInicio) => {
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
};

// Função para adicionar meses a uma data
const adicionarMeses = (data, meses) => {
  const novaData = new Date(data);
  novaData.setMonth(novaData.getMonth() + meses);
  return novaData;
};

// Função para formatar data como YYYY-MM-DD
const formatarData = (data) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

// Função para calcular horário da meia hora (30 minutos antes do culto)
const calcularHoraMeiaHora = (horaCulto) => {
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
};

// Função para verificar se organista tocou recentemente (evitar sequências)
// Verifica se tocou nos últimos 7 dias para evitar cultos muito próximos
const organistaTocouRecentemente = (organistaId, dataAtual, rodiziosGerados, diasVerificar = 7) => {
  const dataLimite = new Date(dataAtual);
  dataLimite.setDate(dataLimite.getDate() - diasVerificar);
  
  return rodiziosGerados.some(r => {
    const dataRodizio = new Date(r.data_culto);
    return r.organista_id === organistaId && 
           dataRodizio >= dataLimite && 
           dataRodizio < dataAtual;
  });
};

// Função para verificar se organista tocou em cultos muito próximos (dentro de X dias)
const organistaTocouMuitoProximo = (organistaId, dataAtual, rodiziosGerados, diasMinimos = 7) => {
  return rodiziosGerados.some(r => {
    if (r.organista_id !== organistaId) return false;
    
    const dataRodizio = new Date(r.data_culto);
    const diferencaDias = Math.abs((dataAtual - dataRodizio) / (1000 * 60 * 60 * 24));
    
    // Se tocou em um culto dentro dos dias mínimos (antes ou depois), evitar
    return diferencaDias < diasMinimos && diferencaDias > 0;
  });
};

// Função para verificar se organista tocou no mesmo dia da semana recentemente
const organistaTocouNoMesmoDiaSemana = (organistaId, diaSemana, rodiziosGerados) => {
  return rodiziosGerados.some(r => 
    r.organista_id === organistaId && 
    r.dia_semana.toLowerCase() === diaSemana.toLowerCase()
  );
};

// Função para contar quantas vezes cada organista tocou em cada dia da semana
const contarTocadasPorDiaSemana = (organistas, rodiziosGerados) => {
  const contadores = {};
  
  organistas.forEach(o => {
    contadores[o.id] = {};
    // Inicializar contadores para cada dia da semana
    ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'].forEach(dia => {
      contadores[o.id][dia] = 0;
    });
  });
  
  rodiziosGerados.forEach(r => {
    if (contadores[r.organista_id] && r.dia_semana) {
      const dia = r.dia_semana.toLowerCase();
      contadores[r.organista_id][dia] = (contadores[r.organista_id][dia] || 0) + 1;
    }
  });
  
  return contadores;
};

// Função para verificar se organista sempre faz a mesma função (verifica desequilíbrio)
const organistaSempreMesmaFuncao = (organistaId, funcao, rodiziosGerados) => {
  const rodiziosOrganista = rodiziosGerados.filter(r => r.organista_id === organistaId);
  
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
const distribuirOrganistas = (organistas, rodiziosGerados, dataAtual, funcao, diaSemana) => {
  // Criar contadores de quantas vezes cada organista já tocou em cada função
  const contadoresMeiaHora = {};
  const contadoresTocarCulto = {};
  const contadoresTotal = {};
  
  organistas.forEach(o => {
    contadoresMeiaHora[o.id] = rodiziosGerados.filter(r => 
      r.organista_id === o.id && r.funcao === 'meia_hora'
    ).length;
    
    contadoresTocarCulto[o.id] = rodiziosGerados.filter(r => 
      r.organista_id === o.id && r.funcao === 'tocar_culto'
    ).length;
    
    contadoresTotal[o.id] = rodiziosGerados.filter(r => 
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
  const contadoresPorDia = contarTocadasPorDiaSemana(organistas, rodiziosGerados);
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
    const aSempreMesma = organistaSempreMesmaFuncao(a.id, funcao, rodiziosGerados);
    const bSempreMesma = organistaSempreMesmaFuncao(b.id, funcao, rodiziosGerados);
    
    if (aSempreMesma && !bSempreMesma) return 1; // A sempre faz, B não - priorizar B
    if (!aSempreMesma && bSempreMesma) return -1; // B sempre faz, A não - priorizar A
    
    // Prioridade 4: Menor contador total (garantir que todas toquem igualmente)
    const diffTotal = contadoresTotal[a.id] - contadoresTotal[b.id];
    if (diffTotal !== 0) return diffTotal;
    
    // Prioridade 5: Verificar se tocou muito recentemente (evitar cultos seguidos)
    const aTocouMuitoProximo = organistaTocouMuitoProximo(a.id, dataAtual, rodiziosGerados, 7);
    const bTocouMuitoProximo = organistaTocouMuitoProximo(b.id, dataAtual, rodiziosGerados, 7);
    
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
    const jaEscaladaOutraFuncao = rodiziosGerados.some(r => 
      r.organista_id === organista.id && 
      r.data_culto === formatarData(dataAtual) &&
      r.funcao !== funcao
    );
    
    const tocouMuitoProximo = organistaTocouMuitoProximo(organista.id, dataAtual, rodiziosGerados, 7);
    
    return !jaEscaladaOutraFuncao && !tocouMuitoProximo;
  });
  
  // Se não há organistas disponíveis (todas já escaladas ou tocaram recentemente), 
  // usar as que não estão escaladas para outra função (mesmo que tenham tocado recentemente)
  if (organistasDisponiveis.length === 0) {
    const organistasNaoEscaladas = organistasOrdenadas.filter(organista => {
      const jaEscaladaOutraFuncao = rodiziosGerados.some(r => 
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

const gerarRodizio = async (igrejaId, periodoMeses, cicloInicial = null) => {
  const pool = db.getDb();
  
  try {
    // 1. Buscar informações da igreja (incluindo se permite mesma organista para ambas funções)
    const [igrejas] = await pool.execute(
      'SELECT * FROM igrejas WHERE id = ?',
      [igrejaId]
    );
    
    if (igrejas.length === 0) {
      throw new Error('Igreja não encontrada');
    }
    
    const igreja = igrejas[0];
    const permiteMesmaOrganista = igreja.mesma_organista_ambas_funcoes === 1;
    const rodizioCiclo = Number(igreja.rodizio_ciclo || 0);
    
    // 2. Buscar cultos ativos da igreja
    const [cultos] = await pool.execute(
      'SELECT * FROM cultos WHERE igreja_id = ? AND ativo = 1',
      [igrejaId]
    );
    
    if (cultos.length === 0) {
      throw new Error('Nenhum culto ativo encontrado para esta igreja');
    }
    
    // 3. Buscar organistas associadas da igreja (ativas). A regra de "não-oficializada só meia_hora"
    // será aplicada na seleção das funções.
    // Ordem agora vem de organistas_igreja.ordem (ordem por igreja)
    const [organistasRaw] = await pool.execute(
      `SELECT o.*, 
              oi.oficializada as associacao_oficializada,
              oi.ordem as associacao_ordem
       FROM organistas o
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
       WHERE oi.igreja_id = ?
         AND o.ativa = 1
       ORDER BY (oi.ordem IS NULL), oi.ordem ASC, oi.id ASC, oi.created_at ASC`,
      [igrejaId]
    );
    
    // 4. Calcular o ciclo baseado no número de CULTOS (não organistas)
    // O ciclo varia de 0 a (numero_cultos - 1), depois volta para 0
    // Exemplo: Igreja com 2 cultos e 6 organistas
    //   Ciclo 1 (rodizioCiclo=0): [1,2,3,4,5,6] (inverte os primeiros 1 = nada muda)
    //   Ciclo 2 (rodizioCiclo=1): [2,1,3,4,5,6] (inverte os primeiros 2)
    //   Ciclo 1 (rodizioCiclo=2): [1,2,3,4,5,6] (volta ao ciclo 1)
    // Exemplo: Igreja com 3 cultos e 9 organistas
    //   Ciclo 1 (rodizioCiclo=0): [1,2,3,4,5,6,7,8,9] (inverte os primeiros 1)
    //   Ciclo 2 (rodizioCiclo=1): [2,1,3,4,5,6,7,8,9] (inverte os primeiros 2)
    //   Ciclo 3 (rodizioCiclo=2): [3,2,1,4,5,6,7,8,9] (inverte os primeiros 3)
    //   Ciclo 1 (rodizioCiclo=3): [1,2,3,4,5,6,7,8,9] (volta ao ciclo 1)
    const numeroCultos = cultos.length;
    const numeroOrganistas = organistasRaw.length;
    
    let cicloCalculado;
    if (cicloInicial !== null && cicloInicial > 0) {
      // ciclo_inicial vem como 1-based (1, 2, 3...), converter para 0-based (0, 1, 2...)
      cicloCalculado = (cicloInicial - 1) % numeroCultos;
    } else {
      // Usar o ciclo da igreja se não foi especificado
      cicloCalculado = numeroCultos > 0 ? (rodizioCiclo % numeroCultos) : 0;
    }
    
    let organistasOrdenadas = aplicarCicloOrdem(ordemBaseOrganistas(organistasRaw), cicloCalculado);
    
    console.log(`[DEBUG] Organistas associadas encontradas:`, organistasOrdenadas.length);
    console.log(`[DEBUG] Cultos ativos encontrados:`, numeroCultos);
    console.log(`[DEBUG] Ciclo inicial escolhido: ${cicloInicial || 'não especificado (usando ciclo da igreja: ' + rodizioCiclo + ')'}`);
    console.log(`[DEBUG] Ciclo calculado: ${cicloCalculado + 1} (baseado em ${numeroCultos} cultos)`);
    console.log(`[DEBUG] Ordem aplicada:`, organistasOrdenadas.map(o => {
      const ordem = o.associacao_ordem !== undefined ? o.associacao_ordem : o.ordem;
      return { id: o.id, ordem: ordem ?? null, nome: o.nome };
    }));
    
    if (organistasOrdenadas.length === 0) {
      const [organistasOficializadas] = await pool.execute(
        `SELECT COUNT(*) as total FROM organistas WHERE oficializada = 1 AND ativa = 1`
      );
      
      const [associacoes] = await pool.execute(
        `SELECT COUNT(*) as total FROM organistas_igreja WHERE igreja_id = ?`,
        [igrejaId]
      );
      
      if (organistasOficializadas[0].total > 0) {
        if (associacoes[0].total === 0) {
          throw new Error(
            'Nenhuma organista oficializada associada a esta igreja. ' +
            'Acesse a página de Igrejas, clique em "Organistas" da igreja e adicione as organistas oficializadas.'
          );
        } else {
          throw new Error(
            'Organistas associadas encontradas, mas não estão marcadas como oficializadas. ' +
            'Verifique se as organistas estão marcadas como "Oficializada" e "Ativa" na página de Organistas.'
          );
        }
      } else {
        throw new Error(
          'Nenhuma organista oficializada cadastrada no sistema. ' +
          'Cadastre organistas e marque-as como "Oficializada" na página de Organistas.'
        );
      }
    }
    
    // 4. Buscar rodízios existentes (incluindo organista_id e dia_semana para rotação)
    const [rodiziosExistentes] = await pool.execute(
      `SELECT r.culto_id, r.data_culto, r.funcao, r.organista_id, c.dia_semana
       FROM rodizios r
       INNER JOIN cultos c ON r.culto_id = c.id
       WHERE r.igreja_id = ? 
       ORDER BY r.data_culto DESC, r.hora_culto DESC`,
      [igrejaId]
    );
    
    // 5. Gerar datas para o período
    const dataInicio = new Date();
    const dataFim = adicionarMeses(dataInicio, periodoMeses);
    
    // 6. Gerar rodízio
    const novosRodizios = [];
    // Inicializar rodiziosGerados com os existentes para ter histórico completo
    const rodiziosGerados = rodiziosExistentes.map(r => ({
      organista_id: r.organista_id,
      data_culto: r.data_culto,
      dia_semana: r.dia_semana,
      funcao: r.funcao,
      culto_id: r.culto_id
    }));
    
    // Rastrear qual dia cada organista tocou em cada ciclo
    // Estrutura: { organistaId: { ciclo: { indiceCulto, data } } }
    // Exemplo: { 1: { 0: { indiceCulto: 0, data: ... }, 1: { indiceCulto: 1, data: ... } } }
    // = organista 1 tocou no culto 0 (segunda) no ciclo 0, e no culto 1 (quarta) no ciclo 1
    const historicoDiasOrganistas = {};
    
    // Inicializar histórico com rodízios existentes
    // Agrupar rodízios por organista e por data para determinar o ciclo
    const rodiziosPorOrganista = {};
    rodiziosExistentes.forEach(r => {
      if (!r.organista_id || !r.dia_semana) return;
      
      if (!rodiziosPorOrganista[r.organista_id]) {
        rodiziosPorOrganista[r.organista_id] = [];
      }
      
      const cultoEncontrado = cultos.find(c => c.id === r.culto_id);
      if (!cultoEncontrado) return;
      
      const indiceCulto = cultos.findIndex(c => c.dia_semana.toLowerCase() === cultoEncontrado.dia_semana.toLowerCase());
      if (indiceCulto === -1) return;
      
      rodiziosPorOrganista[r.organista_id].push({
        data: new Date(r.data_culto),
        indiceCulto: indiceCulto,
        culto_id: r.culto_id
      });
    });
    
    // Para cada organista, ordenar rodízios por data e determinar o ciclo
    Object.keys(rodiziosPorOrganista).forEach(organistaId => {
      const rodizios = rodiziosPorOrganista[organistaId].sort((a, b) => a.data - b.data);
      
      if (!historicoDiasOrganistas[organistaId]) {
        historicoDiasOrganistas[organistaId] = {};
      }
      
      // Agrupar rodízios por semana/ciclo aproximado
      // Assumir que cada ciclo tem numeroCultos cultos (um por dia)
      let cicloAtual = 0;
      let ultimoIndiceCulto = -1;
      
      rodizios.forEach((rodizio, idx) => {
        // Se mudou de dia (índice do culto), pode ter mudado de ciclo
        if (ultimoIndiceCulto !== -1 && rodizio.indiceCulto !== ultimoIndiceCulto) {
          // Se voltou para um dia anterior (ex: quarta -> segunda), novo ciclo
          if (rodizio.indiceCulto < ultimoIndiceCulto) {
            cicloAtual++;
          }
        }
        
        ultimoIndiceCulto = rodizio.indiceCulto;
        const cicloMod = cicloAtual % numeroCultos;
        
        // Registrar o dia que esta organista tocou neste ciclo
        if (!historicoDiasOrganistas[organistaId][cicloMod] || 
            historicoDiasOrganistas[organistaId][cicloMod].data < rodizio.data) {
          historicoDiasOrganistas[organistaId][cicloMod] = {
            indiceCulto: rodizio.indiceCulto,
            data: rodizio.data
          };
        }
      });
    });
    
    console.log(`[DEBUG] Histórico inicializado para ${Object.keys(historicoDiasOrganistas).length} organista(s)`);
    
    // Primeiro, coletar TODAS as datas de TODOS os cultos em ordem cronológica
    const todasDatas = [];
    for (const culto of cultos) {
      let dataAtual = getProximaData(culto.dia_semana, dataInicio);
      while (dataAtual <= dataFim) {
        const dataFormatada = formatarData(dataAtual);
        
        // Verificar se já existe rodízio para esta data e culto
        const existeMeiaHora = rodiziosExistentes.some(r => {
          const dataExistente = r.data_culto instanceof Date 
            ? formatarData(r.data_culto) 
            : r.data_culto;
          return dataExistente === dataFormatada && 
                 r.culto_id === culto.id && 
                 r.funcao === 'meia_hora';
        });
        
        const existeTocarCulto = rodiziosExistentes.some(r => {
          const dataExistente = r.data_culto instanceof Date 
            ? formatarData(r.data_culto) 
            : r.data_culto;
          return dataExistente === dataFormatada && 
                 r.culto_id === culto.id && 
                 r.funcao === 'tocar_culto';
        });
        
        // Só adicionar se não existir ambos
        if (!existeMeiaHora || !existeTocarCulto) {
          todasDatas.push({
            culto: culto,
            data: new Date(dataAtual),
            dataFormatada: dataFormatada,
            existeMeiaHora: existeMeiaHora,
            existeTocarCulto: existeTocarCulto
          });
        }
        
        dataAtual = new Date(dataAtual);
        dataAtual.setDate(dataAtual.getDate() + 7);
      }
    }
    
    // Ordenar todas as datas em ordem cronológica
    todasDatas.sort((a, b) => a.data - b.data);
    
    // Função auxiliar para encontrar qual foi a ÚLTIMA organista que tocou em cada dia da semana
    // Agrupa por semana para garantir rotação correta
    const encontrarUltimaOrganistaPorDia = (diaSemana, dataAtual, rodiziosGerados) => {
      // Filtrar rodízios deste dia da semana
      const rodiziosDia = rodiziosGerados.filter(r => 
        r.dia_semana && r.dia_semana.toLowerCase() === diaSemana.toLowerCase()
      );
      
      if (rodiziosDia.length === 0) {
        return null; // Nunca tocou neste dia
      }
      
      // Ordenar por data (mais recente primeiro)
      rodiziosDia.sort((a, b) => {
        const dataA = new Date(a.data_culto);
        const dataB = new Date(b.data_culto);
        return dataB - dataA;
      });
      
      // Pegar a organista do rodízio mais recente ANTES da data atual
      // (não considerar rodízios da mesma data que está sendo processada)
      const dataAtualDate = new Date(dataAtual);
      const rodizioAnterior = rodiziosDia.find(r => {
        const dataRodizio = new Date(r.data_culto);
        return dataRodizio < dataAtualDate;
      });
      
      if (rodizioAnterior) {
        return rodizioAnterior.organista_id;
      }
      
      // Se não encontrou anterior, pegar o mais recente (pode ser da mesma data se já foi processado)
      return rodiziosDia[0].organista_id;
    };
    
    // Função para encontrar todas as organistas que já tocaram neste dia, ordenadas por data
    // Considera apenas rodízios ANTES da data atual (não os que estão sendo gerados agora)
    const encontrarOrganistasQueTocaramNesteDia = (diaSemana, dataAtual, rodiziosGerados, organistasOrdenadasCicloAtual = []) => {
      const dataAtualDate = new Date(dataAtual);
      dataAtualDate.setHours(0, 0, 0, 0); // Normalizar para início do dia
      
      const rodiziosDia = rodiziosGerados.filter(r => {
        if (!r.dia_semana || r.dia_semana.toLowerCase() !== diaSemana.toLowerCase()) {
          return false;
        }
        
        const dataRodizio = new Date(r.data_culto);
        dataRodizio.setHours(0, 0, 0, 0);
        
        // Apenas rodízios ANTES da data atual (não incluir o mesmo dia)
        return dataRodizio < dataAtualDate;
      });
      
      if (rodiziosDia.length === 0) {
        return [];
      }
      
      // Agrupar por organista e pegar a data mais recente de cada uma
      const organistasPorData = {};
      rodiziosDia.forEach(r => {
        const dataRodizio = new Date(r.data_culto);
        dataRodizio.setHours(0, 0, 0, 0);
        
        if (!organistasPorData[r.organista_id] || organistasPorData[r.organista_id] < dataRodizio) {
          organistasPorData[r.organista_id] = dataRodizio;
        }
      });
      
      // Ordenar por data (mais recente primeiro)
      const organistasOrdenadas = Object.entries(organistasPorData)
        .sort((a, b) => b[1] - a[1])
        .map(([organistaId]) => parseInt(organistaId));
      
      if (organistasOrdenadasCicloAtual.length > 0) {
        console.log(`[DEBUG] Organistas que tocaram em ${diaSemana} antes de ${dataAtual}:`, organistasOrdenadas.map(id => {
          const org = organistasOrdenadasCicloAtual.find(o => o.id === id);
          return org ? org.nome : id;
        }).join(', '));
      }
      
      return organistasOrdenadas;
    };
    
    // Função para contar quantas vezes cada organista tocou em cada dia da semana
    const contarTocadasPorDia = (organistas, rodiziosGerados) => {
      const contadores = {};
      organistas.forEach(org => {
        contadores[org.id] = {};
        cultos.forEach(culto => {
          const rodiziosDia = rodiziosGerados.filter(r => 
            r.organista_id === org.id && 
            r.dia_semana.toLowerCase() === culto.dia_semana.toLowerCase()
          );
          contadores[org.id][culto.dia_semana] = rodiziosDia.length;
        });
      });
      return contadores;
    };
    
    // Processar cada data em ordem cronológica
    for (const item of todasDatas) {
      const { culto, dataFormatada, existeMeiaHora, existeTocarCulto } = item;
      
      // Função auxiliar para obter último rodízio gerado (qualquer culto)
      const obterUltimoRodizio = () => {
        if (rodiziosGerados.length === 0) return null;
        
        // Buscar o último rodízio gerado (mais recente por data)
        const rodiziosOrdenados = [...rodiziosGerados]
          .sort((a, b) => new Date(b.data_culto) - new Date(a.data_culto));
        
        if (rodiziosOrdenados.length === 0) return null;
        
        // Pegar a data mais recente
        const dataAnterior = rodiziosOrdenados[0].data_culto;
        
        // Buscar TODAS as funções dessa data
        const rodiziosDataAnterior = rodiziosOrdenados.filter(r => r.data_culto === dataAnterior);
        
        const meiaHora = rodiziosDataAnterior.find(r => r.funcao === 'meia_hora');
        const tocarCulto = rodiziosDataAnterior.find(r => r.funcao === 'tocar_culto');
        
        if (!meiaHora || !tocarCulto) return null;
        
        return {
          organistaMeiaHora: meiaHora.organista_id,
          organistaTocarCulto: tocarCulto.organista_id
        };
      };
      
      // Se não existe nenhum dos dois, gerar ambos com rotação em pares
      if (!existeMeiaHora && !existeTocarCulto) {
        let organistaMeiaHora, organistaTocarCulto;
        
        // Verificar se a igreja permite mesma organista para ambas funções
        if (permiteMesmaOrganista) {
          // Mesma organista para ambas funções: usar rotação simples
          const organistasOrdenadasPorId = organistasOrdenadas;
          // Contar quantos cultos já foram gerados (cada culto tem 2 rodízios quando mesma organista)
          const numeroCulto = rodiziosGerados.filter(r => r.funcao === 'meia_hora').length;
          const indiceOrganista = numeroCulto % organistasOrdenadasPorId.length;
          const organistaEscolhida = organistasOrdenadasPorId[indiceOrganista];
          
          if (!isOficializadaParaCulto(organistaEscolhida)) {
            const proximaOficializada = organistasOrdenadasPorId.find(o => isOficializadaParaCulto(o));
            if (!proximaOficializada) {
              throw new Error('Esta igreja está configurada para a mesma organista fazer meia hora e culto, mas não existe organista oficializada ativa associada.');
            }
            organistaMeiaHora = proximaOficializada;
            organistaTocarCulto = proximaOficializada;
          } else {
            organistaMeiaHora = organistaEscolhida;
            organistaTocarCulto = organistaEscolhida; // Mesma organista para ambas
          }

          console.log(`[DEBUG] Igreja permite mesma organista: ${organistaMeiaHora.nome} (ID:${organistaMeiaHora.id}) faz ambas funções`);
        } else {
          // Duas organistas diferentes: distribuir baseado na ordem do ciclo
          // LÓGICA DE ROTAÇÃO FORÇADA: Cada organista toca em um dia diferente a cada ciclo
          // Se tocou segunda no ciclo anterior, toca quarta no próximo ciclo
          
          // Contar quantos cultos já foram gerados NESTA EXECUÇÃO (não incluir os existentes)
          // Os rodízios existentes já foram processados no histórico inicial
          const numeroCultosGeradosNestaExecucao = novosRodizios.length / 2; // Cada culto tem 2 rodízios (meia_hora e tocar_culto)
          
          // Calcular qual ciclo estamos (baseado em quantos ciclos completos já foram nesta execução)
          const cicloAtual = cicloCalculado + Math.floor(numeroCultosGeradosNestaExecucao / numeroCultos);
          const cicloAtualMod = cicloAtual % numeroCultos;
          
          // Recalcular a ordem das organistas para o ciclo atual
          const organistasBase = ordemBaseOrganistas(organistasRaw);
          const organistasOrdenadasCicloAtual = aplicarCicloOrdem(organistasBase, cicloAtualMod);
          
          // Encontrar o índice do culto atual (qual dia da semana é este culto)
          const indiceCulto = cultos.findIndex(c => c.id === culto.id);
          
          // LÓGICA DE ROTAÇÃO FORÇADA POR CICLO:
          // Se uma organista tocou em um dia no ciclo anterior, ela NÃO pode tocar no mesmo dia no ciclo atual
          // Exemplo: Se tocou segunda no ciclo 0, não pode tocar segunda no ciclo 1 (deve tocar quarta)
          
          const cicloAnterior = (cicloAtualMod - 1 + numeroCultos) % numeroCultos;
          
          console.log(`[DEBUG] Ciclo atual: ${cicloAtualMod + 1}, Ciclo anterior: ${cicloAnterior + 1}, Dia: ${culto.dia_semana} (índice: ${indiceCulto})`);
          
          const contadoresPorDia = contarTocadasPorDia(organistasOrdenadasCicloAtual, rodiziosGerados);
          
          // Filtrar: EXCLUIR organistas que tocaram neste dia no ciclo anterior
          const organistasCandidatas = organistasOrdenadasCicloAtual.filter(org => {
            const historico = historicoDiasOrganistas[org.id];
            
            // Se a organista já tocou neste dia no ciclo atual, excluir
            if (historico && historico[cicloAtualMod] && historico[cicloAtualMod].indiceCulto === indiceCulto) {
              console.log(`[DEBUG] Excluindo ${org.nome} - já tocou em ${culto.dia_semana} no ciclo atual (${cicloAtualMod + 1})`);
              return false;
            }
            
            // Se a organista tocou neste dia no ciclo anterior, excluir (forçar rotação)
            if (historico && historico[cicloAnterior] && historico[cicloAnterior].indiceCulto === indiceCulto) {
              console.log(`[DEBUG] Excluindo ${org.nome} - tocou em ${culto.dia_semana} no ciclo anterior (${cicloAnterior + 1}), forçando rotação`);
              return false;
            }
            
            return true;
          });
          
          console.log(`[DEBUG] Organistas candidatas após exclusão por ciclo: ${organistasCandidatas.map(o => o.nome).join(', ')}`);
          
          // Se não houver candidatas (todas foram excluídas), usar todas (caso extremo)
          let organistasParaFiltrar = organistasCandidatas.length > 0 
            ? organistasCandidatas 
            : organistasOrdenadasCicloAtual;
          
          if (organistasParaFiltrar.length === 0) {
            organistasParaFiltrar = organistasOrdenadasCicloAtual;
            console.log(`[DEBUG] AVISO: Todas as organistas foram excluídas, usando todas`);
          }
          
          // Encontrar o menor contador para este dia entre as candidatas
          const minContador = Math.min(...organistasParaFiltrar.map(org => 
            contadoresPorDia[org.id][culto.dia_semana] || 0
          ));
          const maxContador = Math.max(...organistasParaFiltrar.map(org => 
            contadoresPorDia[org.id][culto.dia_semana] || 0
          ));
          
          // Filtrar: priorizar apenas organistas que tocaram MENOS vezes neste dia
          const organistasCandidatasFinais = organistasParaFiltrar.filter(org => {
            const contador = contadoresPorDia[org.id][culto.dia_semana] || 0;
            // Se há diferença, só permitir quem tocou menos vezes
            if (maxContador > minContador) {
              return contador === minContador;
            }
            // Se todas tocaram igualmente, permitir todas
            return true;
          });
          
          // Ordenar candidatas por: quem tocou menos vezes neste dia
          const organistasOrdenadasPorMenosTocadas = [...organistasCandidatasFinais].sort((a, b) => {
            const contadorA = contadoresPorDia[a.id][culto.dia_semana] || 0;
            const contadorB = contadoresPorDia[b.id][culto.dia_semana] || 0;
            if (contadorA !== contadorB) {
              return contadorA - contadorB; // Menor contador primeiro
            }
            // Se empatou, manter ordem do ciclo
            return 0;
          });
          
          console.log(`[DEBUG] Dia ${culto.dia_semana}: Min=${minContador}, Max=${maxContador}, Candidatas=${organistasCandidatasFinais.length}`);
          organistasOrdenadasPorMenosTocadas.forEach((org, idx) => {
            const contador = contadoresPorDia[org.id][culto.dia_semana] || 0;
            console.log(`[DEBUG]   ${idx + 1}. ${org.nome}: ${contador} vez(es) neste dia`);
          });
          
          // Usar as organistas ordenadas por quem tocou menos vezes neste dia
          let organistasParaDistribuir;
          if (organistasOrdenadasPorMenosTocadas.length > 0) {
            organistasParaDistribuir = organistasOrdenadasPorMenosTocadas;
              } else {
            // Fallback: usar todas exceto as últimas que tocaram
            organistasParaDistribuir = organistasParaFiltrar;
            console.log(`[DEBUG] Fallback: usando organistas filtradas`);
          }
          
          // Usar distribuição equilibrada, mas priorizando as candidatas (já ordenadas por quem tocou menos)
          organistaMeiaHora = distribuirOrganistas(organistasParaDistribuir, rodiziosGerados, item.data, 'meia_hora', culto.dia_semana);
          
          console.log(`[DEBUG] Organista escolhida para meia_hora: ${organistaMeiaHora.nome} (ID:${organistaMeiaHora.id})`);
          
          console.log(`[DEBUG] Organista escolhida para meia_hora: ${organistaMeiaHora.nome} (ID:${organistaMeiaHora.id}) no dia ${indiceCulto} (${culto.dia_semana})`);
          
          // Para tocar_culto, aplicar a mesma lógica de rotação forçada
          // Excluir organistas que tocaram neste dia no ciclo anterior E a organista escolhida para meia_hora
          const organistasParaCulto = organistasParaDistribuir.filter(o => {
            if (o.id === organistaMeiaHora.id) return false;
            if (!isOficializadaParaCulto(o)) return false;
            
            const historico = historicoDiasOrganistas[o.id];
            // Excluir se tocou neste dia no ciclo anterior
            if (historico && historico[cicloAnterior] && historico[cicloAnterior].indiceCulto === indiceCulto) {
              return false;
            }
            // Excluir se já tocou neste dia no ciclo atual
            if (historico && historico[cicloAtualMod] && historico[cicloAtualMod].indiceCulto === indiceCulto) {
              return false;
            }
            return true;
          });
          
          if (organistasParaCulto.length > 0) {
            organistaTocarCulto = distribuirOrganistas(organistasParaCulto, rodiziosGerados, item.data, 'tocar_culto', culto.dia_semana);
            console.log(`[DEBUG] Organista escolhida para tocar_culto: ${organistaTocarCulto.nome} (ID:${organistaTocarCulto.id})`);
          } else {
            // Se não houver organista oficializada nas candidatas, buscar em todas (exceto meia_hora)
            const organistasOficializadas = organistasOrdenadasCicloAtual.filter(o => {
              if (o.id === organistaMeiaHora.id) return false;
              if (!isOficializadaParaCulto(o)) return false;
              
              const historico = historicoDiasOrganistas[o.id];
              // Excluir se tocou neste dia no ciclo anterior
              if (historico && historico[cicloAnterior] && historico[cicloAnterior].indiceCulto === indiceCulto) {
                return false;
              }
              return true;
            });
            if (organistasOficializadas.length > 0) {
              organistaTocarCulto = distribuirOrganistas(organistasOficializadas, rodiziosGerados, item.data, 'tocar_culto', culto.dia_semana);
              console.log(`[DEBUG] Organista escolhida para tocar_culto (fallback): ${organistaTocarCulto.nome} (ID:${organistaTocarCulto.id})`);
            } else {
              // Último recurso: buscar qualquer organista oficializada (exceto meia_hora)
              const qualquerOficializada = organistasOrdenadasCicloAtual.find(o => 
                o.id !== organistaMeiaHora.id && 
                isOficializadaParaCulto(o)
              );
              if (qualquerOficializada) {
                organistaTocarCulto = qualquerOficializada;
                console.log(`[DEBUG] Organista escolhida para tocar_culto (último recurso): ${organistaTocarCulto.nome} (ID:${organistaTocarCulto.id})`);
              } else {
                throw new Error('Não existe organista oficializada ativa associada para a função "Tocar no Culto".');
              }
            }
          }

          // Regra: não-oficializada só pode ficar em meia_hora; tocar_culto precisa ser oficializada.
          // Se por algum motivo a organista escolhida para tocar_culto não for oficializada, buscar outra
          if (!isOficializadaParaCulto(organistaTocarCulto)) {
            if (isOficializadaParaCulto(organistaMeiaHora)) {
              // Inverter se a meia_hora for oficializada
              const tmp = organistaMeiaHora;
              organistaMeiaHora = organistaTocarCulto;
              organistaTocarCulto = tmp;
            } else {
              // Buscar organista oficializada que não tocou no mesmo dia
              const organistaOficializadaDisponivel = organistasParaDistribuir.find(o => 
                o.id !== organistaMeiaHora.id && 
                isOficializadaParaCulto(o) &&
                !organistaTocouNoMesmoDiaSemana(o.id, culto.dia_semana, rodiziosGerados)
              );
              
              if (organistaOficializadaDisponivel) {
                organistaTocarCulto = organistaOficializadaDisponivel;
              } else {
                // Último recurso: buscar qualquer organista oficializada
                const qualquerOficializada = organistasOrdenadasCicloAtual.find(o => 
                  o.id !== organistaMeiaHora.id && 
                  isOficializadaParaCulto(o)
                );
                if (qualquerOficializada) {
                  organistaTocarCulto = qualquerOficializada;
            } else {
                  throw new Error('Não existe organista oficializada ativa associada para a função "Tocar no Culto".');
                }
              }
            }
          }
          
          const cultoNoCiclo = numeroCulto % numeroCultos;
          console.log(`[DEBUG] Rodízio ${numeroCulto + 1}: Ciclo ${cicloAtualMod + 1}, Culto ${cultoNoCiclo + 1}/${numeroCultos} do ciclo`);
        }
        
        console.log(`[DEBUG] Organistas: Meia Hora=${organistaMeiaHora.nome} (ID:${organistaMeiaHora.id}), Tocar Culto=${organistaTocarCulto.nome} (ID:${organistaTocarCulto.id})`);
        
        // Calcular horário da meia hora
        const horaMeiaHora = calcularHoraMeiaHora(culto.hora);
        
        // Criar rodízios
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
     rodiziosGerados.push(rodizioMeiaHora);
     rodiziosGerados.push(rodizioTocarCulto);
     
     // Atualizar histórico: registrar que estas organistas tocaram neste dia neste ciclo
     // Usar a organista da meia_hora como referência (ou tocar_culto se for a mesma)
     const organistaReferencia = organistaMeiaHora;
     
     if (!historicoDiasOrganistas[organistaReferencia.id]) {
       historicoDiasOrganistas[organistaReferencia.id] = {};
     }
     
     // Registrar o dia que esta organista tocou no ciclo atual
     // Se já existe um registro para este ciclo, manter o mais recente
     if (!historicoDiasOrganistas[organistaReferencia.id][cicloAtualMod] || 
         new Date(historicoDiasOrganistas[organistaReferencia.id][cicloAtualMod].data) < new Date(item.data)) {
       historicoDiasOrganistas[organistaReferencia.id][cicloAtualMod] = {
         indiceCulto: indiceCulto,
         data: new Date(item.data)
       };
     }
     
     // Se a organista de tocar_culto é diferente, também registrar
     if (organistaTocarCulto.id !== organistaReferencia.id) {
       if (!historicoDiasOrganistas[organistaTocarCulto.id]) {
         historicoDiasOrganistas[organistaTocarCulto.id] = {};
       }
       
       if (!historicoDiasOrganistas[organistaTocarCulto.id][cicloAtualMod] || 
           new Date(historicoDiasOrganistas[organistaTocarCulto.id][cicloAtualMod].data) < new Date(item.data)) {
         historicoDiasOrganistas[organistaTocarCulto.id][cicloAtualMod] = {
           indiceCulto: indiceCulto,
           data: new Date(item.data)
         };
       }
     }

     console.log(`[DEBUG] Rodízio gerado para ${dataFormatada}: Meia Hora=${organistaMeiaHora.nome}, Tocar Culto=${organistaTocarCulto.nome}`);
     console.log(`[DEBUG] Histórico atualizado: ${organistaReferencia.nome} tocou em ${culto.dia_semana} (índice ${indiceCulto}) no ciclo ${cicloAtualMod + 1}`);
   } else {
        // Se só falta um, usar a lógica antiga
        if (!existeMeiaHora) {
          const organistaMeiaHora = distribuirOrganistas(
            organistas, 
            rodiziosGerados, 
            item.data, 
            'meia_hora',
            culto.dia_semana
          );
          
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
          
          novosRodizios.push(rodizioMeiaHora);
          rodiziosGerados.push(rodizioMeiaHora);
        }
        
        if (!existeTocarCulto) {
          const organistaTocarCulto = distribuirOrganistas(
            organistas, 
            rodiziosGerados, 
            item.data, 
            'tocar_culto',
            culto.dia_semana
          );
          
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
          
          novosRodizios.push(rodizioTocarCulto);
          rodiziosGerados.push(rodizioTocarCulto);
        }
      }
    }
    
    // 6. Verificar distribuição antes de inserir
    const organistasUsadas = new Set(novosRodizios.map(r => r.organista_id));
    console.log(`[DEBUG] Total de organistas usadas: ${organistasUsadas.size} de ${organistasOrdenadas.length}`);
    console.log(`[DEBUG] Organistas usadas:`, Array.from(organistasUsadas).map(id => {
      const org = organistasOrdenadas.find(o => o.id === id);
      return org ? org.nome : id;
    }).join(', '));
    
    // Contar quantas vezes cada organista foi usada
    const contadoresFinais = {};
    novosRodizios.forEach(r => {
      contadoresFinais[r.organista_id] = (contadoresFinais[r.organista_id] || 0) + 1;
    });
    console.log(`[DEBUG] Distribuição final:`, Object.entries(contadoresFinais).map(([id, count]) => {
      const org = organistasOrdenadas.find(o => o.id === parseInt(id));
      return `${org ? org.nome : id}: ${count} vezes`;
    }).join(', '));
    
    // 7. Inserir rodízios no banco
    if (novosRodizios.length > 0) {
      await inserirRodizios(novosRodizios);
      // Incrementar ciclo do rodízio da igreja a cada geração bem-sucedida
      await pool.execute(
        'UPDATE igrejas SET rodizio_ciclo = rodizio_ciclo + 1 WHERE id = ?',
        [igrejaId]
      );
    }
    
    // 8. Buscar rodízios gerados com informações completas
    const rodiziosCompletos = await buscarRodiziosCompletos(igrejaId, formatarData(dataInicio), formatarData(dataFim));
    
    return rodiziosCompletos;
  } catch (error) {
    throw error;
  }
};

const inserirRodizios = async (rodizios) => {
  const pool = db.getDb();
  
  try {
    const query = `INSERT INTO rodizios 
     (igreja_id, culto_id, organista_id, data_culto, hora_culto, dia_semana, funcao, periodo_inicio, periodo_fim)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    for (const rodizio of rodizios) {
      await pool.execute(query, [
        rodizio.igreja_id,
        rodizio.culto_id,
        rodizio.organista_id,
        rodizio.data_culto,
        rodizio.hora_culto,
        rodizio.dia_semana,
        rodizio.funcao,
        rodizio.periodo_inicio,
        rodizio.periodo_fim
      ]);
    }
  } catch (error) {
    throw error;
  }
};

const buscarRodiziosCompletos = async (igrejaId, periodoInicio, periodoFim) => {
  const pool = db.getDb();
  
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, 
              o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
              i.nome as igreja_nome,
              c.dia_semana, c.hora as hora_culto
       FROM rodizios r
       INNER JOIN organistas o ON r.organista_id = o.id
       INNER JOIN igrejas i ON r.igreja_id = i.id
       INNER JOIN cultos c ON r.culto_id = c.id
       WHERE r.igreja_id = ? AND r.data_culto >= ? AND r.data_culto <= ?
       ORDER BY r.data_culto, r.hora_culto, r.funcao`,
      [igrejaId, periodoInicio, periodoFim]
    );
    
    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  gerarRodizio
};
