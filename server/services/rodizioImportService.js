/**
 * Serviço para importação de rodízio via CSV
 * Valida e processa arquivo CSV com escalas de rodízio
 */

const db = require('../database/db');
const rodizioRepository = require('./rodizioRepository');
const { formatarData } = require('../utils/dateHelpers');
const logger = require('../utils/logger');

// Mapeamento de dias da semana
const DIAS_SEMANA_MAP = {
  'domingo': 'domingo',
  'segunda': 'segunda',
  'terça': 'terça',
  'quarta': 'quarta',
  'quinta': 'quinta',
  'sexta': 'sexta',
  'sábado': 'sábado',
  'sabado': 'sábado' // Aceitar sem acento
};

/**
 * Parse CSV simples (linha por linha)
 * @param {string} csvContent - Conteúdo do CSV
 * @returns {Array} Array de objetos com os dados
 */
function parseCSV(csvContent) {
  const linhas = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (linhas.length < 2) {
    throw new Error('CSV deve ter pelo menos uma linha de cabeçalho e uma linha de dados');
  }
  
  // Primeira linha é o cabeçalho
  const cabecalho = linhas[0].split(',').map(c => c.trim().toLowerCase());
  
  // CORREÇÃO: Aceitar dois formatos de CSV
  // Formato 1 (novo): igreja, data, horario, tipo, organista
  // Formato 2 (antigo): igreja_id, data_culto, dia_semana, hora_culto, organista_id, funcao
  const formatoNovo = ['igreja', 'data', 'horario', 'tipo', 'organista'];
  const formatoAntigo = ['igreja_id', 'data_culto', 'dia_semana', 'hora_culto', 'organista_id', 'funcao'];
  
  const ehFormatoNovo = formatoNovo.every(campo => cabecalho.includes(campo));
  const ehFormatoAntigo = formatoAntigo.every(campo => cabecalho.includes(campo));
  
  if (!ehFormatoNovo && !ehFormatoAntigo) {
    throw new Error(`Cabeçalho inválido. Formatos aceitos:\n1. ${formatoNovo.join(', ')}\n2. ${formatoAntigo.join(', ')}`);
  }
  
  // Mapear índices das colunas baseado no formato
  let indices;
  if (ehFormatoNovo) {
    indices = {
      igreja: cabecalho.indexOf('igreja'),
      data: cabecalho.indexOf('data'),
      horario: cabecalho.indexOf('horario'),
      tipo: cabecalho.indexOf('tipo'),
      organista: cabecalho.indexOf('organista')
    };
  } else {
    indices = {
      igreja_id: cabecalho.indexOf('igreja_id'),
      data_culto: cabecalho.indexOf('data_culto'),
      dia_semana: cabecalho.indexOf('dia_semana'),
      hora_culto: cabecalho.indexOf('hora_culto'),
      organista_id: cabecalho.indexOf('organista_id'),
      funcao: cabecalho.indexOf('funcao')
    };
  }
  
  // Processar linhas de dados
  const dados = [];
  for (let i = 1; i < linhas.length; i++) {
    const valores = linhas[i].split(',').map(v => v.trim());
    
    if (valores.length < cabecalho.length) {
      throw new Error(`Linha ${i + 1}: número insuficiente de colunas`);
    }
    
    if (ehFormatoNovo) {
      // Formato novo: converter para formato interno
      dados.push({
        igreja_nome: valores[indices.igreja],
        data_culto: valores[indices.data],
        hora_culto: valores[indices.horario],
        funcao: valores[indices.tipo].toLowerCase().replace('_', '_'), // Normalizar MEIA_HORA -> meia_hora
        organista_nome: valores[indices.organista]
      });
    } else {
      // Formato antigo: usar diretamente
      dados.push({
        igreja_id: valores[indices.igreja_id],
        data_culto: valores[indices.data_culto],
        dia_semana: valores[indices.dia_semana],
        hora_culto: valores[indices.hora_culto],
        organista_id: valores[indices.organista_id],
        funcao: valores[indices.funcao]
      });
    }
  }
  
  return { dados, formatoNovo: ehFormatoNovo };
}

/**
 * Validar data no formato brasileiro (dd/mm/yyyy)
 * @param {string} dataStr - Data no formato dd/mm/yyyy
 * @returns {Date} Objeto Date ou null se inválida
 */
function validarDataBrasileira(dataStr) {
  if (!dataStr || typeof dataStr !== 'string') return null;
  
  const partes = dataStr.split('/');
  if (partes.length !== 3) return null;
  
  const [dia, mes, ano] = partes.map(Number);
  
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1900 || ano > 2100) return null;
  
  const data = new Date(ano, mes - 1, dia);
  if (data.getDate() !== dia || data.getMonth() !== mes - 1 || data.getFullYear() !== ano) {
    return null;
  }
  
  return data;
}

/**
 * Validar hora no formato HH:MM:SS ou HH:MM
 * @param {string} horaStr - Hora no formato HH:MM:SS ou HH:MM
 * @returns {string} Hora formatada como HH:MM:SS ou null se inválida
 */
function validarHora(horaStr) {
  if (!horaStr || typeof horaStr !== 'string') return null;
  
  // Aceitar HH:MM ou HH:MM:SS
  const partes = horaStr.split(':');
  if (partes.length < 2 || partes.length > 3) return null;
  
  const horas = parseInt(partes[0], 10);
  const minutos = parseInt(partes[1], 10);
  const segundos = partes[2] ? parseInt(partes[2], 10) : 0;
  
  if (isNaN(horas) || isNaN(minutos) || isNaN(segundos)) return null;
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59 || segundos < 0 || segundos > 59) {
    return null;
  }
  
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

/**
 * Importar rodízio a partir de CSV
 * @param {number} userId - ID do usuário que está importando
 * @param {number} igrejaId - ID da igreja (validado pelo middleware)
 * @param {string} csvContent - Conteúdo do arquivo CSV
 * @returns {Object} Resultado da importação
 */
async function importarRodizio(userId, igrejaId, csvContent) {
  const pool = db.getDb();
  
  try {
    // 1. Parse do CSV (retorna { dados, formatoNovo })
    const { dados, formatoNovo } = parseCSV(csvContent);
    
    if (!dados || dados.length === 0) {
      throw new Error('CSV não contém dados válidos');
    }
    
    // 2. Buscar igreja para validar nome (se formato novo)
    let igrejaNome = null;
    if (formatoNovo) {
      const [igrejas] = await pool.execute('SELECT nome FROM igrejas WHERE id = ?', [igrejaId]);
      if (igrejas.length === 0) {
        throw new Error(`Igreja com ID ${igrejaId} não encontrada`);
      }
      igrejaNome = igrejas[0].nome;
    }
    
    // 3. Buscar todas as organistas da igreja (para formato novo que usa nome)
    const [organistasIgreja] = await pool.execute(
      `SELECT o.*, oi.oficializada as associacao_oficializada
       FROM organistas o
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
       WHERE oi.igreja_id = ?
         AND o.ativa = 1`,
      [igrejaId]
    );
    
    const organistasMapPorId = {};
    const organistasMapPorNome = {};
    organistasIgreja.forEach(o => {
      organistasMapPorId[o.id] = {
        id: o.id,
        nome: o.nome,
        oficializada: o.associacao_oficializada === 1 || o.oficializada === 1
      };
      // Normalizar nome para busca (lowercase, sem acentos)
      const nomeNormalizado = o.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      organistasMapPorNome[nomeNormalizado] = {
        id: o.id,
        nome: o.nome,
        oficializada: o.associacao_oficializada === 1 || o.oficializada === 1
      };
    });
    
    // 4. Buscar cultos da igreja
    const [cultos] = await pool.execute(
      'SELECT * FROM cultos WHERE igreja_id = ? AND ativo = 1',
      [igrejaId]
    );
    
    const cultosMap = {};
    cultos.forEach(c => {
      const diaLower = c.dia_semana.toLowerCase();
      if (!cultosMap[diaLower]) {
        cultosMap[diaLower] = [];
      }
      cultosMap[diaLower].push(c);
    });
    
    // 5. Validar e processar cada linha
    const rodiziosParaInserir = [];
    const erros = [];
    const duplicados = [];
    
    for (let i = 0; i < dados.length; i++) {
      const linha = dados[i];
      const numLinha = i + 2; // +2 porque linha 1 é cabeçalho e começamos em 0
      
      try {
        if (formatoNovo) {
          // FORMATO NOVO: igreja, data, horario, tipo, organista
          
          // Validar nome da igreja
          if (linha.igreja_nome && linha.igreja_nome !== igrejaNome) {
            erros.push(`Linha ${numLinha}: igreja "${linha.igreja_nome}" não corresponde à igreja selecionada "${igrejaNome}"`);
            continue;
          }
          
          // Validar data (formato dd/mm/yyyy)
          const dataObj = validarDataBrasileira(linha.data_culto);
          if (!dataObj) {
            erros.push(`Linha ${numLinha}: data "${linha.data_culto}" inválida. Use formato dd/mm/yyyy`);
            continue;
          }
          const dataFormatada = formatarData(dataObj); // YYYY-MM-DD
          
          // Determinar dia da semana a partir da data
          const diaSemanaNum = dataObj.getDay();
          const diasSemanaArray = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
          const diaSemanaLower = diasSemanaArray[diaSemanaNum];
          
          // Verificar se existe culto para este dia
          const cultosDoDia = cultosMap[diaSemanaLower];
          if (!cultosDoDia || cultosDoDia.length === 0) {
            erros.push(`Linha ${numLinha}: não existe culto ativo para ${diaSemanaLower} nesta igreja`);
            continue;
          }
          
          // Usar o primeiro culto do dia
          const culto = cultosDoDia[0];
          
          // Validar hora
          const horaFormatada = validarHora(linha.hora_culto);
          if (!horaFormatada) {
            erros.push(`Linha ${numLinha}: horário "${linha.hora_culto}" inválido. Use formato HH:MM ou HH:MM:SS`);
            continue;
          }
          
          // Buscar organista por nome
          const organistaNomeNormalizado = linha.organista_nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const organista = organistasMapPorNome[organistaNomeNormalizado];
          
          if (!organista) {
            erros.push(`Linha ${numLinha}: organista "${linha.organista_nome}" não encontrada ou não associada à igreja`);
            continue;
          }
          
          // Normalizar função (MEIA_HORA -> meia_hora, CULTO -> tocar_culto)
          let funcao = linha.funcao.toLowerCase().trim();
          if (funcao === 'meia_hora' || funcao === 'meia hora' || funcao === 'meiahora') {
            funcao = 'meia_hora';
          } else if (funcao === 'tocar_culto' || funcao === 'tocar culto' || funcao === 'culto' || funcao === 'tocarculto') {
            funcao = 'tocar_culto';
          } else {
            erros.push(`Linha ${numLinha}: tipo "${linha.funcao}" inválido. Use: MEIA_HORA ou CULTO`);
            continue;
          }
          
          // VALIDAÇÃO CRÍTICA: Organista não oficializada não pode tocar no culto
          if (funcao === 'tocar_culto' && !organista.oficializada) {
            erros.push(`Linha ${numLinha}: organista "${organista.nome}" não é oficializada e não pode tocar no culto. Apenas organistas oficializadas podem ter função "CULTO"`);
            continue;
          }
          
          // Verificar se já existe rodízio (não duplicar)
          const existe = await rodizioRepository.existeRodizio(culto.id, dataFormatada, funcao, organista.id);
          if (existe) {
            duplicados.push({
              linha: numLinha,
              data: linha.data_culto,
              organista: organista.nome,
              funcao: funcao
            });
            continue;
          }
          
          // Criar objeto de rodízio
          rodiziosParaInserir.push({
            igreja_id: igrejaId,
            culto_id: culto.id,
            organista_id: organista.id,
            data_culto: dataFormatada,
            hora_culto: horaFormatada,
            dia_semana: culto.dia_semana,
            funcao: funcao
          });
          
        } else {
          // FORMATO ANTIGO: igreja_id, data_culto, dia_semana, hora_culto, organista_id, funcao
          
          // Validar igreja_id
          const linhaIgrejaId = parseInt(linha.igreja_id);
          if (isNaN(linhaIgrejaId) || linhaIgrejaId !== igrejaId) {
            erros.push(`Linha ${numLinha}: igreja_id inválido ou diferente da igreja selecionada`);
            continue;
          }
          
          // Validar data (formato dd/mm/yyyy)
          const dataObj = validarDataBrasileira(linha.data_culto);
          if (!dataObj) {
            erros.push(`Linha ${numLinha}: data_culto inválida. Use formato dd/mm/yyyy`);
            continue;
          }
          const dataFormatada = formatarData(dataObj); // YYYY-MM-DD
          
          // Validar dia da semana
          const diaSemanaLower = linha.dia_semana.toLowerCase();
          const diaSemanaNormalizado = DIAS_SEMANA_MAP[diaSemanaLower];
          if (!diaSemanaNormalizado) {
            erros.push(`Linha ${numLinha}: dia_semana inválido. Use: domingo, segunda, terça, quarta, quinta, sexta, sábado`);
            continue;
          }
          
          // Verificar se existe culto para este dia
          const cultosDoDia = cultosMap[diaSemanaLower];
          if (!cultosDoDia || cultosDoDia.length === 0) {
            erros.push(`Linha ${numLinha}: não existe culto ativo para ${diaSemanaNormalizado} nesta igreja`);
            continue;
          }
          
          // Usar o primeiro culto do dia
          const culto = cultosDoDia[0];
          
          // Validar hora
          const horaFormatada = validarHora(linha.hora_culto);
          if (!horaFormatada) {
            erros.push(`Linha ${numLinha}: hora_culto inválida. Use formato HH:MM ou HH:MM:SS`);
            continue;
          }
          
          // Validar organista_id
          const organistaId = parseInt(linha.organista_id);
          if (isNaN(organistaId) || !organistasMapPorId[organistaId]) {
            erros.push(`Linha ${numLinha}: organista_id inválido ou não encontrado`);
            continue;
          }
          
          const organista = organistasMapPorId[organistaId];
          
          // Validar função
          const funcao = linha.funcao.toLowerCase();
          if (funcao !== 'meia_hora' && funcao !== 'tocar_culto') {
            erros.push(`Linha ${numLinha}: funcao inválida. Use: meia_hora ou tocar_culto`);
            continue;
          }
          
          // VALIDAÇÃO CRÍTICA: Organista não oficializada não pode tocar no culto
          if (funcao === 'tocar_culto' && !organista.oficializada) {
            erros.push(`Linha ${numLinha}: organista "${organista.nome}" não é oficializada e não pode tocar no culto. Apenas organistas oficializadas podem ter função "tocar_culto"`);
            continue;
          }
          
          // Verificar se já existe rodízio (não duplicar)
          const existe = await rodizioRepository.existeRodizio(culto.id, dataFormatada, funcao, organistaId);
          if (existe) {
            duplicados.push({
              linha: numLinha,
              data: linha.data_culto,
              organista: organista.nome,
              funcao: funcao
            });
            continue;
          }
          
          // Criar objeto de rodízio
          rodiziosParaInserir.push({
            igreja_id: igrejaId,
            culto_id: culto.id,
            organista_id: organistaId,
            data_culto: dataFormatada,
            hora_culto: horaFormatada,
            dia_semana: culto.dia_semana,
            funcao: funcao
          });
        }
        
      } catch (error) {
        erros.push(`Linha ${numLinha}: ${error.message}`);
      }
    }
    
    // 6. Se houver erros, retornar sem inserir nada
    if (erros.length > 0) {
      return {
        sucesso: false,
        erros: erros,
        duplicados: duplicados,
        rodiziosInseridos: 0,
        totalLinhas: dados.length
      };
    }
    
    // 7. Inserir rodízios válidos
    let rodiziosInseridos = 0;
    if (rodiziosParaInserir.length > 0) {
      await rodizioRepository.inserirRodizios(rodiziosParaInserir);
      rodiziosInseridos = rodiziosParaInserir.length;
    }
    
    return {
      sucesso: true,
      erros: [],
      duplicados: duplicados,
      rodiziosInseridos: rodiziosInseridos,
      totalLinhas: dados.length
    };
    
  } catch (error) {
    logger.error('Erro ao importar rodízio:', error);
    // CORREÇÃO: Nunca deixar exception gerar erro 500 sem resposta
    throw new Error(`Erro ao processar importação: ${error.message}`);
  }
}

module.exports = {
  importarRodizio
};
