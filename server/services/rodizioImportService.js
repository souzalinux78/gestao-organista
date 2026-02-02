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
  
  // Validar cabeçalho esperado
  const cabecalhoEsperado = ['igreja_id', 'data_culto', 'dia_semana', 'hora_culto', 'organista_id', 'funcao'];
  const cabecalhoValido = cabecalhoEsperado.every(campo => cabecalho.includes(campo));
  
  if (!cabecalhoValido) {
    throw new Error(`Cabeçalho inválido. Esperado: ${cabecalhoEsperado.join(', ')}`);
  }
  
  // Mapear índices das colunas
  const indices = {
    igreja_id: cabecalho.indexOf('igreja_id'),
    data_culto: cabecalho.indexOf('data_culto'),
    dia_semana: cabecalho.indexOf('dia_semana'),
    hora_culto: cabecalho.indexOf('hora_culto'),
    organista_id: cabecalho.indexOf('organista_id'),
    funcao: cabecalho.indexOf('funcao')
  };
  
  // Processar linhas de dados
  const dados = [];
  for (let i = 1; i < linhas.length; i++) {
    const valores = linhas[i].split(',').map(v => v.trim());
    
    if (valores.length < cabecalho.length) {
      throw new Error(`Linha ${i + 1}: número insuficiente de colunas`);
    }
    
    dados.push({
      igreja_id: valores[indices.igreja_id],
      data_culto: valores[indices.data_culto],
      dia_semana: valores[indices.dia_semana],
      hora_culto: valores[indices.hora_culto],
      organista_id: valores[indices.organista_id],
      funcao: valores[indices.funcao]
    });
  }
  
  return dados;
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
    // 1. Parse do CSV
    const dados = parseCSV(csvContent);
    
    if (dados.length === 0) {
      throw new Error('CSV não contém dados válidos');
    }
    
    // 2. Validar que todas as linhas são da mesma igreja
    const igrejasDiferentes = dados.filter(d => parseInt(d.igreja_id) !== igrejaId);
    if (igrejasDiferentes.length > 0) {
      throw new Error(`Todas as linhas devem ser da igreja ${igrejaId}. Encontradas linhas de outras igrejas.`);
    }
    
    // 3. Validar organistas e cultos
    const organistasIds = [...new Set(dados.map(d => parseInt(d.organista_id)))];
    const [organistas] = await pool.execute(
      `SELECT o.*, oi.oficializada as associacao_oficializada
       FROM organistas o
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id
       WHERE o.id IN (${organistasIds.map(() => '?').join(',')})
         AND oi.igreja_id = ?
         AND o.ativa = 1`,
      [...organistasIds, igrejaId]
    );
    
    const organistasMap = {};
    organistas.forEach(o => {
      organistasMap[o.id] = {
        id: o.id,
        nome: o.nome,
        oficializada: o.associacao_oficializada === 1 || o.oficializada === 1
      };
    });
    
    // Verificar se todas as organistas existem
    const organistasNaoEncontradas = organistasIds.filter(id => !organistasMap[id]);
    if (organistasNaoEncontradas.length > 0) {
      throw new Error(`Organistas não encontradas ou não associadas à igreja: ${organistasNaoEncontradas.join(', ')}`);
    }
    
    // 4. Validar cultos
    const diasSemana = [...new Set(dados.map(d => d.dia_semana.toLowerCase()))];
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
        
        // Usar o primeiro culto do dia (se houver múltiplos, usar o primeiro)
        const culto = cultosDoDia[0];
        
        // Validar hora
        const horaFormatada = validarHora(linha.hora_culto);
        if (!horaFormatada) {
          erros.push(`Linha ${numLinha}: hora_culto inválida. Use formato HH:MM ou HH:MM:SS`);
          continue;
        }
        
        // Validar organista_id
        const organistaId = parseInt(linha.organista_id);
        if (isNaN(organistaId) || !organistasMap[organistaId]) {
          erros.push(`Linha ${numLinha}: organista_id inválido ou não encontrado`);
          continue;
        }
        
        const organista = organistasMap[organistaId];
        
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
        rodiziosInseridos: 0
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
    throw error;
  }
}

module.exports = {
  importarRodizio
};
