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
 * Faz parse de uma linha CSV respeitando campos entre aspas e aspas escapadas ("")
 * @param {string} linha
 * @param {string} delimitador
 * @returns {string[]}
 */
function parseLinhaCSV(linha, delimitador) {
  const campos = [];
  let atual = '';
  let emAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];

    if (ch === '"') {
      if (emAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        emAspas = !emAspas;
      }
      continue;
    }

    if (ch === delimitador && !emAspas) {
      campos.push(atual.trim());
      atual = '';
      continue;
    }

    atual += ch;
  }

  campos.push(atual.trim());
  return campos;
}

/**
 * Parse CSV simples (linha por linha) com detecção automática de delimitador
 * @param {string} csvContent - Conteúdo do CSV
 * @returns {Array} Array de objetos com os dados
 */
function parseCSV(csvContent) {
  // Remover BOM de UTF-8 se existir e caracteres de retorno de carro (\r)
  const limpo = csvContent.replace(/^\uFEFF/, '').replace(/\r/g, '');
  const linhas = limpo.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (linhas.length < 2) {
    throw new Error('CSV deve ter pelo menos uma linha de cabeçalho e uma linha de dados');
  }

  // Detectar delimitador (vírgula ou ponto e vírgula) baseado na primeira linha
  const cabecalhoLinha = linhas[0];
  const countComma = (cabecalhoLinha.match(/,/g) || []).length;
  const countSemicolon = (cabecalhoLinha.match(/;/g) || []).length;
  const delimitador = countSemicolon > countComma ? ';' : ',';

  logger.info(`[IMPORT] Delimitador detectado: "${delimitador}" (vírgulas: ${countComma}, ponto-e-vírgulas: ${countSemicolon})`);

  // Primeira linha é o cabeçalho
  const cabecalho = parseLinhaCSV(cabecalhoLinha, delimitador)
    .map(c => c.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

  // Formatos aceitos
  const formatoNovo = ['igreja', 'data', 'horario', 'tipo', 'organista'];
  const formatoAntigo = ['igreja_id', 'data_culto', 'dia_semana', 'hora_culto', 'organista_id', 'funcao'];

  const ehFormatoNovo = formatoNovo.every(campo => cabecalho.includes(campo));
  const ehFormatoAntigo = formatoAntigo.every(campo => cabecalho.includes(campo));

  if (!ehFormatoNovo && !ehFormatoAntigo) {
    // Se não encontrou cabeçalho exato, aceitar aliases essenciais (tipo/funcao)
    const possuiData = cabecalho.some(c => c.includes('data'));
    const possuiTipoOuFuncao = cabecalho.some(c => c.includes('tipo') || c.includes('funcao'));
    const possuiOrganista = cabecalho.some(c => c.includes('organista'));
    const possuiEssenciais = possuiData && possuiTipoOuFuncao && possuiOrganista;

    if (!possuiEssenciais) {
      throw new Error(`Cabeçalho não reconhecido. Use colunas: ${formatoNovo.join(', ')} (separadas por vírgula ou ponto e vírgula)`);
    }
  }

  // Mapear índices das colunas
  let indices = {};
  if (ehFormatoNovo || !ehFormatoAntigo) {
    indices = {
      igreja: cabecalho.findIndex(c => c.includes('igreja')),
      data: cabecalho.findIndex(c => c.includes('data')),
      horario: cabecalho.findIndex(c => c.includes('horar') || c.includes('hora')),
      tipo: cabecalho.findIndex(c => c.includes('tipo') || c.includes('funcao')),
      organista: cabecalho.findIndex(c => c.includes('organista'))
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
    // CORREÇÃO CRÍTICA: Usar o delimitador detectado para separar as colunas nos dados também!
    const valores = parseLinhaCSV(linhas[i], delimitador);

    if (valores.length < cabecalho.length) {
      logger.warn(`[IMPORT] Linha ${i + 1} ignorada: colunas insuficientes. Esperado ${cabecalho.length}, encontrado ${valores.length}`, { valores, delimitador });
      continue; // Pular linhas mal formadas em vez de quebrar tudo
    }

    // Mapear campos baseado nos índices detectados (Formato Novo)
    if (indices.data !== -1) {
      dados.push({
        igreja_nome: indices.igreja !== -1 ? valores[indices.igreja] : null,
        data_culto: valores[indices.data],
        hora_culto: indices.horario !== -1 ? valores[indices.horario] : '00:00',
        funcao: indices.tipo !== -1 ? valores[indices.tipo] : 'tocar_culto',
        organista_nome: indices.organista !== -1 ? valores[indices.organista] : null
      });
    } else if (indices.data_culto !== -1) {
      // Formato antigo: mapear para estrutura interna
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

  return { dados, formatoNovo: indices.data !== -1 };
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
    logger.info(`[IMPORT] Iniciando importação de rodízio - Usuário: ${userId}, Igreja: ${igrejaId}`);

    // 1. Parse do CSV (retorna { dados, formatoNovo })
    let dados, formatoNovo;
    try {
      const resultado = parseCSV(csvContent);
      dados = resultado.dados;
      formatoNovo = resultado.formatoNovo;
    } catch (parseError) {
      logger.error('[IMPORT] Erro ao fazer parse do CSV:', parseError);
      throw new Error(`Erro ao processar CSV: ${parseError.message}`);
    }

    if (!dados || dados.length === 0) {
      throw new Error('CSV não contém dados válidos');
    }

    logger.info(`[IMPORT] CSV parseado com sucesso - ${dados.length} linha(s) encontrada(s), formato: ${formatoNovo ? 'novo' : 'antigo'}`);

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
      // Normalizar nome para busca (lowercase, sem acentos, trim)
      const nomeNormalizado = o.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
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

          // Validar nome da igreja (Case-insensitive e sem acentos) - Opcional se já temos o ID
          const linhaIgrejaNormalizada = linha.igreja_nome?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          const igrejaNomeNormalizado = igrejaNome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

          if (linha.igreja_nome && linhaIgrejaNormalizada !== igrejaNomeNormalizado) {
            logger.warn(`[IMPORT] Linha ${numLinha}: nome da igreja "${linha.igreja_nome}" é diferente de "${igrejaNome}". Prosseguindo pelo ID.`);
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

          // Normalizar função
          let funcaoOriginal = linha.funcao?.toLowerCase().trim();
          let funcao = 'tocar_culto';
          let ehRJM = false;

          if (funcaoOriginal === 'meia_hora' || funcaoOriginal === 'meia hora' || funcaoOriginal === 'meiahora' || funcaoOriginal === 'meia') {
            funcao = 'meia_hora';
          } else if (funcaoOriginal === 'rjm') {
            funcao = 'tocar_culto';
            ehRJM = true;
          } else if (funcaoOriginal === 'tocar_culto' || funcaoOriginal === 'tocar culto' || funcaoOriginal === 'culto' || funcaoOriginal === 'tocarculto') {
            funcao = 'tocar_culto';
          } else {
            erros.push(`Linha ${numLinha}: tipo "${linha.funcao}" inválido. Use: MEIA_HORA, CULTO ou RJM`);
            continue;
          }

          // Verificar se existe culto para este dia
          const cultosDoDia = cultosMap[diaSemanaLower];
          if (!cultosDoDia || cultosDoDia.length === 0) {
            const diasDisponiveis = Object.keys(cultosMap).join(', ');
            erros.push(`Linha ${numLinha}: não existe culto para ${diaSemanaLower} (${linha.data_culto}). Dias ativos nesta igreja: ${diasDisponiveis}`);
            continue;
          }

          // Tentar encontrar o culto que melhor corresponde ao tipo (RJM vs Regular)
          let culto = cultosDoDia.find(c => ehRJM ? c.tipo === 'rjm' : c.tipo !== 'rjm');
          if (!culto) {
            // Se não achou correspondência exata de tipo, usa o primeiro disponível mas avisa
            culto = cultosDoDia[0];
            logger.info(`[IMPORT] Linha ${numLinha}: Culto do tipo "${ehRJM ? 'RJM' : 'Regular'}" não encontrado na ${diaSemanaLower}. Usando "${culto.tipo}" do dia.`);
          }

          // Validar hora
          const horaFormatada = validarHora(linha.hora_culto);
          if (!horaFormatada) {
            erros.push(`Linha ${numLinha}: horário "${linha.hora_culto}" inválido. Use formato HH:MM`);
            continue;
          }

          // Buscar organista por nome (Normalização profunda)
          const organistaNomeCSV = linha.organista_nome?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          let organista = organistasMapPorNome[organistaNomeCSV];

          // Se não achou por nome exato, tentar por "contém"
          if (!organista && organistaNomeCSV) {
            const matchingKey = Object.keys(organistasMapPorNome).find(nome =>
              nome.includes(organistaNomeCSV) || organistaNomeCSV.includes(nome)
            );
            if (matchingKey) {
              organista = organistasMapPorNome[matchingKey];
              logger.info(`[IMPORT] Linha ${numLinha}: Organista "${linha.organista_nome}" mapeada para "${organista.nome}"`);
            }
          }

          if (!organista) {
            const nomesDisponiveis = Object.values(organistasMapPorNome).map(o => o.nome).slice(0, 5).join(', ');
            erros.push(`Linha ${numLinha}: organista "${linha.organista_nome}" NÃO encontrada. Sugestões: ${nomesDisponiveis}...`);
            continue;
          }

          // VALIDAÇÃO CRÍTICA: Organista não oficializada não pode tocar no culto (Exceto RJM)
          if (funcao === 'tocar_culto' && !ehRJM && !organista.oficializada) {
            erros.push(`Linha ${numLinha}: organista "${organista.nome}" não é oficializada e não pode tocar no culto comum. Apenas oficializadas podem ter função "CULTO"`);
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

          // Criar objeto de rodízio (nunca com campos undefined)
          const rodizio = {
            igreja_id: igrejaId ?? null,
            culto_id: culto?.id ?? null,
            organista_id: organista?.id ?? null,
            data_culto: dataFormatada ?? null,
            hora_culto: horaFormatada ?? null,
            dia_semana: culto?.dia_semana ?? null,
            funcao: funcao ?? null,
            periodo_inicio: dataFormatada ?? null,
            periodo_fim: dataFormatada ?? null
          };

          // Validar campos obrigatórios antes de inserir
          const camposObrigatorios = ['igreja_id', 'culto_id', 'organista_id', 'data_culto', 'hora_culto', 'dia_semana', 'funcao'];
          const camposInvalidos = camposObrigatorios.filter(campo => rodizio[campo] === null);
          if (camposInvalidos.length > 0) {
            logger.warn(`[IMPORT] Linha ${numLinha}: campos obrigatórios ausentes -> ${camposInvalidos.join(', ')}`);
            erros.push(`Linha ${numLinha}: campos obrigatórios ausentes (${camposInvalidos.join(', ')})`);
            continue;
          }

          rodiziosParaInserir.push(rodizio);

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

          // Criar objeto de rodízio (nunca com campos undefined)
          const rodizio = {
            igreja_id: igrejaId ?? null,
            culto_id: culto?.id ?? null,
            organista_id: organistaId ?? null,
            data_culto: dataFormatada ?? null,
            hora_culto: horaFormatada ?? null,
            dia_semana: culto?.dia_semana ?? null,
            funcao: funcao ?? null,
            periodo_inicio: dataFormatada ?? null,
            periodo_fim: dataFormatada ?? null
          };

          // Validar campos obrigatórios antes de inserir
          const camposObrigatorios = ['igreja_id', 'culto_id', 'organista_id', 'data_culto', 'hora_culto', 'dia_semana', 'funcao'];
          const camposInvalidos = camposObrigatorios.filter(campo => rodizio[campo] === null);
          if (camposInvalidos.length > 0) {
            logger.warn(`[IMPORT] Linha ${numLinha}: campos obrigatórios ausentes -> ${camposInvalidos.join(', ')}`);
            erros.push(`Linha ${numLinha}: campos obrigatórios ausentes (${camposInvalidos.join(', ')})`);
            continue;
          }

          rodiziosParaInserir.push(rodizio);
        }

      } catch (error) {
        erros.push(`Linha ${numLinha}: ${error.message}`);
      }
    }

    // 6. Se houver erros, retornar sem inserir nada
    if (erros.length > 0) {
      logger.warn(`[IMPORT] Importação falhou - ${erros.length} erro(s) encontrado(s), ${duplicados.length} duplicado(s)`);
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
      logger.info(`[IMPORT] Inserindo ${rodiziosParaInserir.length} rodízio(s) válido(s)...`);

      try {
        await rodizioRepository.inserirRodizios(rodiziosParaInserir);
        rodiziosInseridos = rodiziosParaInserir.length;
        logger.info(`[IMPORT] ${rodiziosInseridos} rodízio(s) inserido(s) com sucesso`);
      } catch (insertError) {
        logger.error('[IMPORT] Erro ao inserir rodízios no banco:', insertError);
        throw new Error(`Erro ao salvar rodízios no banco de dados: ${insertError.message}`);
      }
    } else {
      logger.warn('[IMPORT] Nenhum rodízio válido para inserir');
    }

    logger.info(`[IMPORT] Importação concluída - ${rodiziosInseridos} inserido(s), ${duplicados.length} duplicado(s), ${dados.length} total`);

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

