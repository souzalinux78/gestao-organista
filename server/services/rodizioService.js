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

const gerarRodizio = async (igrejaId, periodoMeses, cicloInicial = null, dataInicial = null, organistaInicial = null) => {
  const pool = db.getDb();
  
  try {
    const [igrejas] = await pool.execute(
      'SELECT * FROM igrejas WHERE id = ?',
      [igrejaId]
    );
    
    if (igrejas.length === 0) {
      throw new Error('Igreja não encontrada');
    }
    
    const igreja = igrejas[0];
    const permiteMesmaOrganista = igreja.mesma_organista_ambas_funcoes === 1;
    
    const [cultos] = await pool.execute(
      'SELECT * FROM cultos WHERE igreja_id = ? AND ativo = 1 ORDER BY dia_semana',
      [igrejaId]
    );
    
    if (cultos.length === 0) {
      throw new Error('Nenhum culto ativo encontrado para esta igreja');
    }
    
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
    // A função gerarOrdemCiclo espera:
    // - ciclo 0 = ordem normal
    // - ciclo 1 = inverte 2 primeiros
    // - ciclo 2 = inverte 3 primeiros
    // Então usamos cicloInicial diretamente (sem subtrair 1)
    let cicloAtual = cicloInicial !== null && cicloInicial !== undefined 
      ? cicloInicial 
      : Number(igreja.rodizio_ciclo || 0);
    
    if (cicloAtual < 0) {
      cicloAtual = 0;
    }
    
    const gerarOrdemCiclo = (ciclo, totalDias, totalOrganistas) => {
      // Criar lista base de índices [0, 1, 2, ..., totalOrganistas-1]
      const ordem = [];
      for (let i = 0; i < totalOrganistas; i++) {
        ordem.push(i);
      }
      
      // Ciclo 0 = ordem normal (sem inversão)
      if (ciclo === 0) {
        return ordem;
      }
      
      // Aplicar inversão baseada no ciclo:
      // Ciclo 1 = inverter os 2 primeiros [1, 0, 2, 3, ...]
      // Ciclo 2 = inverter os 3 primeiros [2, 1, 0, 3, 4, ...]
      // Ciclo N = inverter os (N+1) primeiros
      const n = totalOrganistas;
      if (n <= 1) return ordem;
      
      // k = número de elementos a inverter (1..n)
      // Para ciclo 0: k = 1 (não inverte, retorna normal)
      // Para ciclo 1: k = 2 (inverte 2 primeiros)
      // Para ciclo 2: k = 3 (inverte 3 primeiros)
      const k = (ciclo % n) + 1;
      
      // Se k = 1, não há inversão (ordem normal)
      if (k === 1) {
        return ordem;
      }
      
      // Inverter os k primeiros elementos
      const prefixo = ordem.slice(0, k).reverse();
      const sufixo = ordem.slice(k);
      
      return [...prefixo, ...sufixo];
    };
    
    const dataInicio = dataInicial ? new Date(dataInicial) : new Date();
    const dataFim = adicionarMeses(dataInicio, periodoMeses);
    
    const todasDatas = [];
    for (const culto of cultos) {
      let dataAtual = getProximaData(culto.dia_semana, dataInicio);
      while (dataAtual <= dataFim) {
        const dataFormatada = formatarData(dataAtual);
        const [rodiziosExistentes] = await pool.execute(
          `SELECT id FROM rodizios 
           WHERE culto_id = ? AND data_culto = ?`,
          [culto.id, dataFormatada]
        );
        if (rodiziosExistentes.length === 0) {
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
      const diaCultoAtual = culto.dia_semana.toLowerCase();
      
      if (indiceOrganista >= totalOrganistas) {
        cicloAtual++;
        indiceOrganista = 0;
      }
      
      const ordemCiclo = gerarOrdemCiclo(cicloAtual, totalDias, totalOrganistas);
      const indiceReal = ordemCiclo[indiceOrganista];
      const organistaSelecionada = organistas[indiceReal];
      const indiceDia = indiceOrganista % totalDias;
      const diaCalculado = diasCulto[indiceDia];
      
      if (diaCalculado !== diaCultoAtual) {
        continue;
      }
      
      indiceOrganista++;
      
      let organistaMeiaHora, organistaTocarCulto;
      
      if (permiteMesmaOrganista) {
        if (!organistaSelecionada.oficializada) {
          const proximaOficializada = organistas.find(o => o.oficializada);
          if (!proximaOficializada) {
            throw new Error('Não existe organista oficializada ativa associada.');
          }
          organistaMeiaHora = proximaOficializada;
          organistaTocarCulto = proximaOficializada;
        } else {
          organistaMeiaHora = organistaSelecionada;
          organistaTocarCulto = organistaSelecionada;
        }
      } else {
        organistaMeiaHora = organistaSelecionada;
        let organistaTocarCultoEncontrada = null;
        const indiceAnterior = indiceOrganista - 1;
        for (let i = 1; i < totalOrganistas; i++) {
          const idxProximo = (indiceAnterior + i) % totalOrganistas;
          const indiceRealProximo = ordemCiclo[idxProximo];
          const org = organistas[indiceRealProximo];
          if (org.oficializada) {
            organistaTocarCultoEncontrada = org;
            break;
          }
        }
        if (!organistaTocarCultoEncontrada) {
          organistaTocarCultoEncontrada = organistas.find(o => o.oficializada);
          if (!organistaTocarCultoEncontrada) {
            throw new Error('Não existe organista oficializada ativa associada para a função "Tocar no Culto".');
          }
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
      await inserirRodizios(novosRodizios);
      await pool.execute(
        'UPDATE igrejas SET rodizio_ciclo = ? WHERE id = ?',
        [cicloAtual, igrejaId]
      );
    }
    
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
