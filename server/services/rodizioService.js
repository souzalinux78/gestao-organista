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
// Reduzido para 1 dia para permitir mais distribuição
const organistaTocouRecentemente = (organistaId, dataAtual, rodiziosGerados, diasVerificar = 1) => {
  const dataLimite = new Date(dataAtual);
  dataLimite.setDate(dataLimite.getDate() - diasVerificar);
  
  return rodiziosGerados.some(r => {
    const dataRodizio = new Date(r.data_culto);
    return r.organista_id === organistaId && 
           dataRodizio >= dataLimite && 
           dataRodizio < dataAtual;
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
  // 5. Quem não tocou no mesmo dia da semana
  // 6. Quem não tocou recentemente
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
    
    // Prioridade 5: Verificar se tocou no mesmo dia da semana
    const aTocouMesmoDia = organistaTocouNoMesmoDiaSemana(a.id, diaSemana, rodiziosGerados);
    const bTocouMesmoDia = organistaTocouNoMesmoDiaSemana(b.id, diaSemana, rodiziosGerados);
    
    if (aTocouMesmoDia && !bTocouMesmoDia) return 1;
    if (!aTocouMesmoDia && bTocouMesmoDia) return -1;
    
    // Prioridade 6: Verificar se tocou recentemente
    const aTocou = organistaTocouRecentemente(a.id, dataAtual, rodiziosGerados);
    const bTocou = organistaTocouRecentemente(b.id, dataAtual, rodiziosGerados);
    
    if (aTocou && !bTocou) return 1;
    if (!aTocou && bTocou) return -1;
    
    return 0;
  });
  
  // Retornar a primeira que:
  // 1. Não está escalada para outra função no mesmo culto (OBRIGATÓRIO)
  // 2. Priorizar quem menos fez esta função específica
  // 3. Priorizar quem menos tocou no total (garantir distribuição)
  
  // Primeiro, filtrar organistas que já estão escaladas para outra função no mesmo culto
  const organistasDisponiveis = organistasOrdenadas.filter(organista => {
    const jaEscaladaOutraFuncao = rodiziosGerados.some(r => 
      r.organista_id === organista.id && 
      r.data_culto === formatarData(dataAtual) &&
      r.funcao !== funcao
    );
    return !jaEscaladaOutraFuncao;
  });
  
  // Se não há organistas disponíveis (todas já escaladas), retornar a primeira da lista original
  if (organistasDisponiveis.length === 0) {
    return organistasOrdenadas[0];
  }
  
  // Retornar a primeira disponível (já está ordenada por quem menos fez)
  return organistasDisponiveis[0];
};

const gerarRodizio = async (igrejaId, periodoMeses) => {
  const pool = db.getDb();
  
  try {
    // 1. Buscar cultos ativos da igreja
    const [cultos] = await pool.execute(
      'SELECT * FROM cultos WHERE igreja_id = ? AND ativo = 1',
      [igrejaId]
    );
    
    if (cultos.length === 0) {
      throw new Error('Nenhum culto ativo encontrado para esta igreja');
    }
    
    // 2. Buscar organistas oficializadas da igreja ordenadas por ordem de associação (mais antiga primeiro)
    const [organistas] = await pool.execute(
      `SELECT o.* FROM organistas o
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
       WHERE oi.igreja_id = ? 
         AND oi.oficializada = 1 
         AND o.oficializada = 1 
         AND o.ativa = 1
       ORDER BY oi.id ASC, oi.created_at ASC`,
      [igrejaId]
    );
    
    console.log(`[DEBUG] Organistas oficializadas encontradas:`, organistas.length);
    console.log(`[DEBUG] Organistas:`, organistas.map(o => ({ id: o.id, nome: o.nome })));
    
    if (organistas.length === 0) {
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
    
    // 3. Buscar rodízios existentes
    const [rodiziosExistentes] = await pool.execute(
      `SELECT culto_id, data_culto, funcao 
       FROM rodizios 
       WHERE igreja_id = ? 
       ORDER BY data_culto DESC`,
      [igrejaId]
    );
    
    // 4. Gerar datas para o período
    const dataInicio = new Date();
    const dataFim = adicionarMeses(dataInicio, periodoMeses);
    
    // 5. Gerar rodízio
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
      
      // Se não existe nenhum dos dois, gerar ambos com inversão de funções
      if (!existeMeiaHora && !existeTocarCulto) {
        const rodizioAnterior = obterUltimoRodizio();
        
        let organistaMeiaHora, organistaTocarCulto;
        
        // Calcular contadores para todas as organistas
        const contadoresTotal = {};
        const contadoresMeiaHora = {};
        const contadoresTocarCulto = {};
        
        organistas.forEach(o => {
          contadoresTotal[o.id] = rodiziosGerados.filter(r => r.organista_id === o.id).length;
          contadoresMeiaHora[o.id] = rodiziosGerados.filter(r => 
            r.organista_id === o.id && r.funcao === 'meia_hora'
          ).length;
          contadoresTocarCulto[o.id] = rodiziosGerados.filter(r => 
            r.organista_id === o.id && r.funcao === 'tocar_culto'
          ).length;
        });
        
        // Ordenar organistas por: 1) quem menos fez cada função, 2) quem menos tocou no total
        const organistasOrdenadasMeiaHora = [...organistas].sort((a, b) => {
          // Prioridade 1: quem menos fez meia_hora
          const diffMeiaHora = contadoresMeiaHora[a.id] - contadoresMeiaHora[b.id];
          if (diffMeiaHora !== 0) return diffMeiaHora;
          // Prioridade 2: quem menos tocou no total
          return contadoresTotal[a.id] - contadoresTotal[b.id];
        });
        
        const organistasOrdenadasTocarCulto = [...organistas].sort((a, b) => {
          // Prioridade 1: quem menos fez tocar_culto
          const diffTocarCulto = contadoresTocarCulto[a.id] - contadoresTocarCulto[b.id];
          if (diffTocarCulto !== 0) return diffTocarCulto;
          // Prioridade 2: quem menos tocou no total
          return contadoresTotal[a.id] - contadoresTotal[b.id];
        });
        
        // Verificar se há rodízio anterior para inverter
        if (rodizioAnterior) {
          const organistaAnteriorMeiaHora = organistas.find(o => 
            o.id === rodizioAnterior.organistaMeiaHora
          );
          const organistaAnteriorTocarCulto = organistas.find(o => 
            o.id === rodizioAnterior.organistaTocarCulto
          );
          
          // Se ambas estão disponíveis e estão entre as que menos tocaram, inverter
          if (organistaAnteriorMeiaHora && organistaAnteriorTocarCulto) {
            const menorContador = Math.min(...Object.values(contadoresTotal));
            const ambasMenosTocaram = 
              contadoresTotal[organistaAnteriorMeiaHora.id] === menorContador &&
              contadoresTotal[organistaAnteriorTocarCulto.id] === menorContador;
            
            if (ambasMenosTocaram) {
              // Inverter funções
              organistaMeiaHora = organistaAnteriorTocarCulto;
              organistaTocarCulto = organistaAnteriorMeiaHora;
            } else {
              // Usar as que menos tocaram/fizeram cada função
              organistaMeiaHora = organistasOrdenadasMeiaHora[0];
              organistaTocarCulto = organistasOrdenadasTocarCulto.find(o => 
                o.id !== organistaMeiaHora.id
              ) || organistasOrdenadasTocarCulto[0];
            }
          } else {
            // Usar as que menos tocaram/fizeram cada função
            organistaMeiaHora = organistasOrdenadasMeiaHora[0];
            organistaTocarCulto = organistasOrdenadasTocarCulto.find(o => 
              o.id !== organistaMeiaHora.id
            ) || organistasOrdenadasTocarCulto[0];
          }
        } else {
          // Primeira vez - escolher baseado em quem menos fez cada função
          organistaMeiaHora = organistasOrdenadasMeiaHora[0];
          organistaTocarCulto = organistasOrdenadasTocarCulto.find(o => 
            o.id !== organistaMeiaHora.id
          ) || organistasOrdenadasTocarCulto[0];
        }
        
        // Garantir que são diferentes
        if (organistaMeiaHora.id === organistaTocarCulto.id && organistas.length > 1) {
          // Se são iguais e há mais organistas, escolher a próxima que menos tocou
          const proximaOrganista = organistasOrdenadasTocarCulto.find(o => 
            o.id !== organistaMeiaHora.id
          );
          
          if (proximaOrganista) {
            organistaTocarCulto = proximaOrganista;
          } else {
            // Se não encontrou, pegar qualquer outra
            const outraOrganista = organistas.find(o => o.id !== organistaMeiaHora.id);
            if (outraOrganista) {
              organistaTocarCulto = outraOrganista;
            }
          }
        }
        
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
    console.log(`[DEBUG] Total de organistas usadas: ${organistasUsadas.size} de ${organistas.length}`);
    console.log(`[DEBUG] Organistas usadas:`, Array.from(organistasUsadas).map(id => {
      const org = organistas.find(o => o.id === id);
      return org ? org.nome : id;
    }).join(', '));
    
    // Contar quantas vezes cada organista foi usada
    const contadoresFinais = {};
    novosRodizios.forEach(r => {
      contadoresFinais[r.organista_id] = (contadoresFinais[r.organista_id] || 0) + 1;
    });
    console.log(`[DEBUG] Distribuição final:`, Object.entries(contadoresFinais).map(([id, count]) => {
      const org = organistas.find(o => o.id === parseInt(id));
      return `${org ? org.nome : id}: ${count} vezes`;
    }).join(', '));
    
    // 7. Inserir rodízios no banco
    if (novosRodizios.length > 0) {
      await inserirRodizios(novosRodizios);
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
