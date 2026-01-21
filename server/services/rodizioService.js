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
  
  // Ordenar por:
  // 1. Menor contador da função específica (prioridade: quem menos fez esta função)
  // 2. Menor desequilíbrio (priorizar quem tem funções mais equilibradas)
  // 3. Penalizar quem sempre faz a mesma função
  // 4. Menor contador total (garantir que todas toquem igualmente)
  // 5. Quem não tocou muito recentemente (evitar cultos seguidos)
  // 6. Quem não tocou no mesmo dia da semana
  // 7. Ordem de cadastro (menor ID = mais antiga)
  const organistasOrdenadas = [...organistas].sort((a, b) => {
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
    
    // Prioridade 6: Verificar se tocou no mesmo dia da semana
    const aTocouMesmoDia = organistaTocouNoMesmoDiaSemana(a.id, diaSemana, rodiziosGerados);
    const bTocouMesmoDia = organistaTocouNoMesmoDiaSemana(b.id, diaSemana, rodiziosGerados);
    
    if (aTocouMesmoDia && !bTocouMesmoDia) return 1;
    if (!aTocouMesmoDia && bTocouMesmoDia) return -1;
    
    // Prioridade 7: Ordem de cadastro (menor ID = mais antiga)
    return a.id - b.id;
  });
  
  // Retornar a primeira que:
  // 1. Não está escalada para outra função no mesmo culto (OBRIGATÓRIO)
  // 2. Priorizar quem menos fez esta função específica
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
  // Preferir a numeração (ordem). Se não tiver, cair no ID (mais antigo primeiro).
  const comOrdem = organistas
    .filter(o => o.ordem !== null && o.ordem !== undefined)
    .sort((a, b) => a.ordem - b.ordem);

  const semOrdem = organistas
    .filter(o => o.ordem === null || o.ordem === undefined)
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

const gerarRodizio = async (igrejaId, periodoMeses) => {
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
    
    // 3. Buscar organistas associadas da igreja (ativas). A regra de “não-oficializada só meia_hora”
    // será aplicada na seleção das funções.
    const [organistasRaw] = await pool.execute(
      `SELECT o.*, oi.oficializada as associacao_oficializada
       FROM organistas o
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
       WHERE oi.igreja_id = ?
         AND o.ativa = 1
       ORDER BY oi.id ASC, oi.created_at ASC`,
      [igrejaId]
    );
    
    const organistasOrdenadas = aplicarCicloOrdem(ordemBaseOrganistas(organistasRaw), rodizioCiclo);
    
    console.log(`[DEBUG] Organistas associadas encontradas:`, organistasOrdenadas.length);
    console.log(`[DEBUG] Ciclo do rodízio (igreja):`, rodizioCiclo);
    console.log(`[DEBUG] Ordem aplicada:`, organistasOrdenadas.map(o => ({ id: o.id, ordem: o.ordem ?? null, nome: o.nome })));
    
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
    
    // 4. Buscar rodízios existentes
    const [rodiziosExistentes] = await pool.execute(
      `SELECT culto_id, data_culto, funcao 
       FROM rodizios 
       WHERE igreja_id = ? 
       ORDER BY data_culto DESC`,
      [igrejaId]
    );
    
    // 5. Gerar datas para o período
    const dataInicio = new Date();
    const dataFim = adicionarMeses(dataInicio, periodoMeses);
    
    // 6. Gerar rodízio
    const novosRodizios = [];
    const rodiziosGerados = []; // Para controle de distribuição
    
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
          // Duas organistas diferentes: usar rotação em pares
          // Ordenar organistas por ID (ordem de cadastro)
          const organistasOrdenadasPorId = organistasOrdenadas;
          
          // Criar pares de organistas (1-2, 3-4, 5-6, etc.)
          const pares = [];
          for (let i = 0; i < organistasOrdenadasPorId.length; i += 2) {
            if (i + 1 < organistasOrdenadasPorId.length) {
              pares.push([organistasOrdenadasPorId[i], organistasOrdenadasPorId[i + 1]]);
            } else {
              // Se número ímpar, última organista forma par com a primeira
              pares.push([organistasOrdenadasPorId[i], organistasOrdenadasPorId[0]]);
            }
          }
          
          // Contar quantos cultos já foram gerados para determinar qual par usar
          const numeroCulto = rodiziosGerados.length / 2; // Cada culto tem 2 rodízios (meia_hora e tocar_culto)
          const indicePar = numeroCulto % pares.length;
          const parAtual = pares[indicePar];
          
          // Determinar se deve inverter o par baseado no ciclo
          // Ciclo 0: par normal (1-2), Ciclo 1: par invertido (2-1), Ciclo 2: par normal (1-2), etc.
          const ciclo = Math.floor(numeroCulto / pares.length);
          const inverterPar = ciclo % 2 === 1;
          
          if (inverterPar) {
            // Par invertido: segunda organista faz meia_hora, primeira faz tocar_culto
            organistaMeiaHora = parAtual[1];
            organistaTocarCulto = parAtual[0];
          } else {
            // Par normal: primeira organista faz meia_hora, segunda faz tocar_culto
            organistaMeiaHora = parAtual[0];
            organistaTocarCulto = parAtual[1];
          }

          // Regra: não-oficializada só pode ficar em meia_hora; tocar_culto precisa ser oficializada.
          // Se cair uma não-oficializada no culto, tentar inverter (se a outra for oficializada) ou buscar outro par.
          if (!isOficializadaParaCulto(organistaTocarCulto)) {
            if (isOficializadaParaCulto(organistaMeiaHora)) {
              const tmp = organistaMeiaHora;
              organistaMeiaHora = organistaTocarCulto;
              organistaTocarCulto = tmp;
            } else {
              // Buscar um par onde a posição de culto seja oficializada
              const parValido = pares.find(par => {
                const a = par[0];
                const b = par[1];
                // Preferir b no culto por padrão do par normal
                return isOficializadaParaCulto(a) || isOficializadaParaCulto(b);
              });
              if (!parValido) {
                throw new Error('Não existe organista oficializada ativa associada para a função "Tocar no Culto".');
              }
              // Forçar uma oficializada para o culto
              const [a, b] = parValido;
              if (isOficializadaParaCulto(b)) {
                organistaMeiaHora = a;
                organistaTocarCulto = b;
              } else {
                organistaMeiaHora = b;
                organistaTocarCulto = a;
              }
            }
          }
          
          // Verificar se as organistas escolhidas tocaram muito recentemente
          const meiaHoraTocouProximo = organistaTocouMuitoProximo(organistaMeiaHora.id, item.data, rodiziosGerados, 7);
          const tocarCultoTocouProximo = organistaTocouMuitoProximo(organistaTocarCulto.id, item.data, rodiziosGerados, 7);
          
          // Se alguma tocou muito recentemente, usar o próximo par disponível
          if (meiaHoraTocouProximo || tocarCultoTocouProximo) {
            // Tentar próximo par
            const proximoIndicePar = (indicePar + 1) % pares.length;
            const proximoPar = pares[proximoIndicePar];
            
            const proximoCiclo = Math.floor((numeroCulto + 1) / pares.length);
            const proximoInverterPar = proximoCiclo % 2 === 1;
            
            if (proximoInverterPar) {
              organistaMeiaHora = proximoPar[1];
              organistaTocarCulto = proximoPar[0];
            } else {
              organistaMeiaHora = proximoPar[0];
              organistaTocarCulto = proximoPar[1];
            }
            
            // Verificar novamente
            const novaMeiaHoraTocouProximo = organistaTocouMuitoProximo(organistaMeiaHora.id, item.data, rodiziosGerados, 7);
            const novaTocarCultoTocouProximo = organistaTocouMuitoProximo(organistaTocarCulto.id, item.data, rodiziosGerados, 7);
            
            // Se ainda tocou muito recentemente, usar qualquer par disponível
            if (novaMeiaHoraTocouProximo || novaTocarCultoTocouProximo) {
              // Buscar primeiro par que não tocou recentemente
              for (const par of pares) {
                const par1Tocou = organistaTocouMuitoProximo(par[0].id, item.data, rodiziosGerados, 7);
                const par2Tocou = organistaTocouMuitoProximo(par[1].id, item.data, rodiziosGerados, 7);
                
                if (!par1Tocou && !par2Tocou) {
                  organistaMeiaHora = par[0];
                  organistaTocarCulto = par[1];
                  break;
                }
              }
            }
          }
          
          console.log(`[DEBUG] Rodízio ${numeroCulto + 1}: Par ${indicePar + 1}/${pares.length}, Ciclo ${ciclo}, Invertido: ${inverterPar}`);
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
        
        console.log(`[DEBUG] Rodízio gerado para ${dataFormatada}: Meia Hora=${organistaMeiaHora.nome}, Tocar Culto=${organistaTocarCulto.nome}`);
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
