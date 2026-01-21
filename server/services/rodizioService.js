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
    // ============================================
    // LÓGICA COMPLETAMENTE REESCRITA
    // Contador global contínuo que nunca reinicia
    // ============================================
    
    // 1. Buscar informações da igreja
    const [igrejas] = await pool.execute(
      'SELECT * FROM igrejas WHERE id = ?',
      [igrejaId]
    );
    
    if (igrejas.length === 0) {
      throw new Error('Igreja não encontrada');
    }
    
    const igreja = igrejas[0];
    const permiteMesmaOrganista = igreja.mesma_organista_ambas_funcoes === 1;
    
    // 2. Buscar cultos ativos da igreja
    const [cultos] = await pool.execute(
      'SELECT * FROM cultos WHERE igreja_id = ? AND ativo = 1 ORDER BY dia_semana',
      [igrejaId]
    );
    
    if (cultos.length === 0) {
      throw new Error('Nenhum culto ativo encontrado para esta igreja');
    }
    
    // 3. Buscar organistas associadas da igreja (ativas) ordenadas por ordem
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
    
    // 4. Preparar arrays simples
    const diasCulto = cultos.map(c => c.dia_semana.toLowerCase());
    const organistas = organistasRaw.map(o => ({
      id: o.id,
      nome: o.nome,
      oficializada: o.associacao_oficializada === 1 || o.oficializada === 1
    }));
    
    // 5. Buscar contador global persistido (ou iniciar em 0)
    let contadorGlobal = Number(igreja.rodizio_ciclo || 0);
    
    console.log(`[DEBUG] Contador global inicial: ${contadorGlobal}`);
    console.log(`[DEBUG] Dias de culto: ${diasCulto.join(', ')}`);
    console.log(`[DEBUG] Organistas: ${organistas.map(o => o.nome).join(', ')}`);
    
    // 6. Calcular período de datas
    const dataInicio = new Date();
    const dataFim = adicionarMeses(dataInicio, periodoMeses);
    
    // 7. Coletar todas as datas de todos os cultos em ordem cronológica
    const todasDatas = [];
    for (const culto of cultos) {
      let dataAtual = getProximaData(culto.dia_semana, dataInicio);
      while (dataAtual <= dataFim) {
        const dataFormatada = formatarData(dataAtual);
        
        // Verificar se já existe rodízio para esta data e culto
        const [rodiziosExistentes] = await pool.execute(
          `SELECT id FROM rodizios 
           WHERE culto_id = ? AND data_culto = ?`,
          [culto.id, dataFormatada]
        );
        
        // Só adicionar se não existir rodízio para este culto nesta data
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
    
    // Ordenar todas as datas em ordem cronológica
    todasDatas.sort((a, b) => a.data - b.data);
    
    console.log(`[DEBUG] Total de cultos a gerar: ${todasDatas.length}`);
    
    // 8. Gerar rodízios usando contador global
    const novosRodizios = [];
    
    for (const item of todasDatas) {
      const { culto, dataFormatada } = item;
      const diaCultoAtual = culto.dia_semana.toLowerCase();
      
      // Calcular organista e dia usando contador global
      const indiceOrganista = contadorGlobal % organistas.length;
      const indiceDia = contadorGlobal % diasCulto.length;
      const diaCalculado = diasCulto[indiceDia];
      
      // Verificar se o dia calculado corresponde ao dia do culto atual
      if (diaCalculado !== diaCultoAtual) {
        // Se não corresponde, pular este culto (não gerar rodízio)
        console.log(`[DEBUG] Pulando ${diaCultoAtual} - dia calculado (${diaCalculado}) não corresponde. Contador: ${contadorGlobal}`);
        continue;
      }
      
      // Selecionar organista
      const organistaSelecionada = organistas[indiceOrganista];
      
      console.log(`[DEBUG] Contador: ${contadorGlobal} | Organista: ${organistaSelecionada.nome} (índice ${indiceOrganista}) | Dia: ${diaCalculado}`);
      
      // Incrementar contador ANTES de gerar os rodízios
      contadorGlobal++;
      
      // Declarar variáveis para as organistas
      let organistaMeiaHora, organistaTocarCulto;
      
      // Gerar rodízios (meia_hora e tocar_culto)
      if (permiteMesmaOrganista) {
        // Mesma organista para ambas funções
        if (!organistaSelecionada.oficializada) {
          // Se não é oficializada, buscar próxima oficializada
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
        // Duas organistas diferentes
        organistaMeiaHora = organistaSelecionada;
        
        // Para tocar_culto, buscar próxima organista oficializada
        let organistaTocarCultoEncontrada = null;
        for (let i = 1; i < organistas.length; i++) {
          const idx = (indiceOrganista + i) % organistas.length;
          const org = organistas[idx];
          if (org.oficializada) {
            organistaTocarCultoEncontrada = org;
            break;
          }
        }
        
        if (!organistaTocarCultoEncontrada) {
          // Último recurso: buscar qualquer organista oficializada
          organistaTocarCultoEncontrada = organistas.find(o => o.oficializada);
          if (!organistaTocarCultoEncontrada) {
            throw new Error('Não existe organista oficializada ativa associada para a função "Tocar no Culto".');
          }
        }
        
        organistaTocarCulto = organistaTocarCultoEncontrada;
      }
      
      // Criar rodízios
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
    
    // 9. Inserir rodízios no banco
    if (novosRodizios.length > 0) {
      await inserirRodizios(novosRodizios);
      
      // Atualizar contador global no banco (PERSISTÊNCIA)
      await pool.execute(
        'UPDATE igrejas SET rodizio_ciclo = ? WHERE id = ?',
        [contadorGlobal, igrejaId]
      );
      
      console.log(`[DEBUG] Contador global atualizado no banco: ${contadorGlobal}`);
    }
    
    // 10. Buscar rodízios gerados com informações completas
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
