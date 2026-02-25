const db = require('../database/db');
const axios = require('axios');
const { TEMPLATE_KEYS, renderTemplate } = require('../utils/messageTemplates');

const TEMPLATE_CACHE_TTL_MS = 5 * 60 * 1000;
const templateCache = new Map();

const clearTemplateCache = (igrejaId = null) => {
  if (igrejaId === null || igrejaId === undefined) {
    templateCache.clear();
    return;
  }
  templateCache.delete(Number(igrejaId));
};

const formatarHoraHHMM = (hora) => {
  if (!hora) return '';
  return String(hora).split(':').slice(0, 2).join(':');
};

const calcularHoraMeiaHoraStr = (horaCulto) => {
  if (!horaCulto) return '';
  const [hora, minuto] = String(horaCulto).split(':');
  const base = new Date();
  base.setHours(parseInt(hora, 10), parseInt(minuto, 10) - 30, 0, 0);
  return `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`;
};

const getFuncaoTexto = (rodizio) => {
  if (rodizio.funcao === 'meia_hora') {
    return 'Meia hora (30 min antes do culto)';
  }
  const isRJM = rodizio.culto_tipo === 'rjm' || rodizio.eh_rjm === 1;
  return isRJM ? 'RJM' : 'Culto';
};

const buildListaRodiziosTexto = (rodizios) => {
  const linhas = [];
  for (const rodizio of rodizios) {
    const horaMeiaHoraStr = calcularHoraMeiaHoraStr(rodizio.hora_culto);
    const horaCulto = formatarHoraHHMM(rodizio.hora_culto);
    const funcaoTexto = getFuncaoTexto(rodizio);
    linhas.push(`${funcaoTexto}`);
    linhas.push(` - Organista: ${rodizio.organista_nome}`);
    linhas.push(` - Telefone: ${rodizio.organista_telefone || 'Nao informado'}`);
    linhas.push(` - Hora: ${horaCulto}`);
    if (rodizio.funcao === 'meia_hora') {
      linhas.push(` - Meia hora: ${horaMeiaHoraStr}`);
    }
    linhas.push('');
  }
  return linhas.join('\n').trim();
};

const getTemplatesByIgreja = async (igrejaId) => {
  if (!igrejaId) return { organista: null, encarregado: null };

  const now = Date.now();
  const cacheItem = templateCache.get(igrejaId);
  if (cacheItem && cacheItem.expiresAt > now) {
    return cacheItem.value;
  }

  const pool = db.getDb();
  const keyOrganista = TEMPLATE_KEYS.organista(igrejaId);
  const keyEncarregado = TEMPLATE_KEYS.encarregado(igrejaId);

  try {
    const [rows] = await pool.execute(
      'SELECT chave, valor FROM configuracoes WHERE chave IN (?, ?)',
      [keyOrganista, keyEncarregado]
    );

    const map = new Map(rows.map(r => [r.chave, r.valor]));
    const value = {
      organista: map.get(keyOrganista) || null,
      encarregado: map.get(keyEncarregado) || null
    };

    templateCache.set(igrejaId, {
      value,
      expiresAt: now + TEMPLATE_CACHE_TTL_MS
    });

    return value;
  } catch (error) {
    console.warn(`[TEMPLATE] Falha ao carregar templates da igreja ${igrejaId}:`, error.message);
    return { organista: null, encarregado: null };
  }
};

// Função para enviar notificação consolidada para encarregados
const enviarNotificacaoEncarregados = async (rodizios, options = {}) => {
  if (!rodizios || rodizios.length === 0) return;
  const referencia = options.referencia || 'hoje';
  
  const primeiroRodizio = rodizios[0];
  const listaRodiziosTexto = buildListaRodiziosTexto(rodizios);
  const templates = await getTemplatesByIgreja(primeiroRodizio.igreja_id);

  // Preparar payload consolidado com todos os rodízios
  const rodiziosFormatados = rodizios.map(rodizio => {
    const horaMeiaHoraStr = calcularHoraMeiaHoraStr(rodizio.hora_culto);
    const funcaoTexto = getFuncaoTexto(rodizio);
    
    return {
      rodizio_id: rodizio.id,
      organista: {
        nome: rodizio.organista_nome || null,
        telefone: rodizio.organista_telefone || null,
        email: rodizio.organista_email || null
      },
      culto: {
        data: rodizio.data_culto || null,
        data_formatada: formatarDataBR(rodizio.data_culto),
        dia_semana: rodizio.dia_semana || null,
        hora: formatarHoraHHMM(rodizio.hora_culto) || null,
        funcao: rodizio.funcao || null,
        funcao_texto: funcaoTexto,
        hora_meia_hora: rodizio.funcao === 'meia_hora' ? horaMeiaHoraStr : null
      }
    };
  });

  let mensagemConsolidada;
  if (templates.encarregado) {
    mensagemConsolidada = renderTemplate(templates.encarregado, {
      referencia,
      data: formatarDataBR(primeiroRodizio.data_culto),
      dia_semana: primeiroRodizio.dia_semana || '',
      igreja_nome: primeiroRodizio.igreja_nome || '',
      lista_rodizios: listaRodiziosTexto,
      organista_nome: primeiroRodizio.organista_nome || '',
      organista_telefone: primeiroRodizio.organista_telefone || '',
      funcao: getFuncaoTexto(primeiroRodizio),
      hora: formatarHoraHHMM(primeiroRodizio.hora_culto),
      hora_meia_hora: calcularHoraMeiaHoraStr(primeiroRodizio.hora_culto)
    }).trim();
  } else {
    mensagemConsolidada = `📢 Notificação: Organistas escaladas para ${referencia}\n\n` +
      `📅 Data: ${formatarDataBR(primeiroRodizio.data_culto)}\n` +
      `📍 Igreja: ${primeiroRodizio.igreja_nome}\n\n` +
      `🎹 Organistas escaladas:\n\n` +
      `${listaRodiziosTexto}`;
  }
  
  // Enviar para encarregado local (1 webhook com todos os rodízios)
  if (primeiroRodizio.encarregado_local_telefone) {
    await enviarMensagemEncarregados(
      primeiroRodizio.encarregado_local_telefone,
      mensagemConsolidada,
      primeiroRodizio,
      rodiziosFormatados
    );
    console.log(`✅ Webhook consolidado enviado para encarregado local: ${primeiroRodizio.encarregado_local_nome}`);
  }
  
  // Enviar para encarregado regional (1 webhook com todos os rodízios)
  if (primeiroRodizio.encarregado_regional_telefone) {
    await enviarMensagemEncarregados(
      primeiroRodizio.encarregado_regional_telefone,
      mensagemConsolidada,
      primeiroRodizio,
      rodiziosFormatados
    );
    console.log(`✅ Webhook consolidado enviado para encarregado regional: ${primeiroRodizio.encarregado_regional_nome}`);
  }
};

const enviarNotificacaoDiaCulto = async (rodizio, enviarParaEncarregados = false, options = {}) => {
  const pool = db.getDb();
  const tipoNotificacao = options.tipoNotificacao || 'alerta_dia_culto';
  
  try {
    const horaMeiaHoraStr = calcularHoraMeiaHoraStr(rodizio.hora_culto);
    const horaCultoSemSegundos = formatarHoraHHMM(rodizio.hora_culto);
    const funcaoTexto = getFuncaoTexto(rodizio);
    const templates = await getTemplatesByIgreja(rodizio.igreja_id);
    
    // Mensagem para a organista (tom congregacional e acolhedor), com fallback para template customizado
    let mensagemOrganista;
    if (templates.organista) {
      mensagemOrganista = removerEmojisAfetivos(renderTemplate(templates.organista, {
        organista_nome: rodizio.organista_nome || '',
        organista_telefone: rodizio.organista_telefone || '',
        igreja_nome: rodizio.igreja_nome || '',
        data: formatarDataBR(rodizio.data_culto),
        dia_semana: rodizio.dia_semana || '',
        funcao: funcaoTexto,
        hora: rodizio.funcao === 'meia_hora' ? horaMeiaHoraStr : horaCultoSemSegundos,
        hora_meia_hora: horaMeiaHoraStr,
        referencia: 'hoje'
      }).trim());
    } else {
      const linhasMensagem = [
        `🎶 Olá, ${rodizio.organista_nome}! A paz de Deus 🙏`,
        '',
        rodizio.data_culto ? `📅 Data: ${formatarDataBR(rodizio.data_culto)}` : null,
        rodizio.igreja_nome ? `📍 Igreja: ${rodizio.igreja_nome}` : null,
        `🎯 Função: ${funcaoTexto}`,
        rodizio.funcao === 'meia_hora'
          ? `🕐 Horário: ${horaMeiaHoraStr}`
          : horaCultoSemSegundos
            ? `🕐 Horário: ${horaCultoSemSegundos}`
            : null,
        '',
        'Que Deus abençoe sua participação nesta noite'
      ].filter(Boolean);
      mensagemOrganista = removerEmojisAfetivos(linhasMensagem.join('\n'));
    }
    
    // Enviar webhook para a organista (1 webhook por organista/rodízio)
    const telefoneOrganista = rodizio.organista_telefone || 'webhook_organista';
    await enviarMensagem(telefoneOrganista, mensagemOrganista, rodizio);
    console.log(`✅ Webhook disparado para organista: ${rodizio.organista_nome} (${rodizio.funcao === 'meia_hora' ? 'Meia Hora' : 'Tocar no Culto'})`);
    
    // Enviar a MESMA mensagem da organista para encarregado local (se configurado)
    if (rodizio.encarregado_local_telefone && rodizio.encarregado_local_telefone.trim()) {
      await enviarMensagem(rodizio.encarregado_local_telefone.trim(), mensagemOrganista, rodizio);
      console.log(`✅ Webhook disparado para encarregado local: ${rodizio.encarregado_local_nome || 'N/A'}`);
    }
    
    // Enviar a MESMA mensagem da organista para encarregado regional (se configurado)
    if (rodizio.encarregado_regional_telefone && rodizio.encarregado_regional_telefone.trim()) {
      await enviarMensagem(rodizio.encarregado_regional_telefone.trim(), mensagemOrganista, rodizio);
      console.log(`✅ Webhook disparado para encarregado regional: ${rodizio.encarregado_regional_nome || 'N/A'}`);
    }
    
    // NÃO enviar mensagem consolidada aqui - será enviado consolidado depois (opcional)
    
    // Registrar notificação no banco
    // Formatar data para MySQL (YYYY-MM-DD HH:MM:SS)
    const agora = new Date();
    const dataEnvioMySQL = agora.toISOString().slice(0, 19).replace('T', ' ');
    
    await pool.execute(
      'INSERT INTO notificacoes (rodizio_id, tipo, enviada, data_envio) VALUES (?, ?, ?, ?)',
      [rodizio.id, tipoNotificacao, 1, dataEnvioMySQL]
    );
    
    console.log(`Notificações enviadas para rodízio ID: ${rodizio.id}`);
  } catch (error) {
    console.error('Erro ao enviar notificações:', error);
    throw error;
  }
};

// Função para formatar data/hora no padrão brasileiro (horário de Brasília)
const formatarTimestampBR = () => {
  const agora = new Date();
  
  // Converter para horário de Brasília (UTC-3)
  // getTimezoneOffset retorna a diferença em minutos (negativo para fusos à frente do UTC)
  // Brasília está UTC-3, então precisamos subtrair 3 horas
  const offsetBrasilia = -3; // UTC-3
  const offsetLocal = agora.getTimezoneOffset() / 60; // offset local em horas
  const diferenca = offsetBrasilia - offsetLocal; // diferença em horas
  
  const brasiliaTime = new Date(agora.getTime() + (diferenca * 60 * 60 * 1000));
  
  const dia = String(brasiliaTime.getUTCDate()).padStart(2, '0');
  const mes = String(brasiliaTime.getUTCMonth() + 1).padStart(2, '0');
  const ano = brasiliaTime.getUTCFullYear();
  const hora = String(brasiliaTime.getUTCHours()).padStart(2, '0');
  const minuto = String(brasiliaTime.getUTCMinutes()).padStart(2, '0');
  const segundo = String(brasiliaTime.getUTCSeconds()).padStart(2, '0');
  
  return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
};

// Função especial para enviar mensagem consolidada para encarregados
const enviarMensagemEncarregados = async (telefone, mensagem, primeiroRodizio, rodiziosFormatados) => {
  const webhookNotificacao = process.env.WEBHOOK_NOTIFICACAO;
  const mensagemSanitizada = removerEmojisAfetivos(mensagem);
  
  if (webhookNotificacao) {
    try {
      const payload = {
        tipo: 'notificacao_encarregados',
        timestamp: formatarTimestampBR(),
        timestamp_iso: new Date().toISOString(),
        destinatario: {
          telefone: telefone || null,
          tipo: telefone === primeiroRodizio.encarregado_local_telefone 
            ? 'encarregado_local' 
            : 'encarregado_regional'
        },
        mensagem: mensagemSanitizada,
        dados: {
          igreja: {
            nome: primeiroRodizio.igreja_nome || null,
            encarregado_local: {
              nome: primeiroRodizio.encarregado_local_nome || null,
              telefone: primeiroRodizio.encarregado_local_telefone || null
            },
            encarregado_regional: {
              nome: primeiroRodizio.encarregado_regional_nome || null,
              telefone: primeiroRodizio.encarregado_regional_telefone || null
            }
          },
          data: primeiroRodizio.data_culto || null,
          data_formatada: formatarDataBR(primeiroRodizio.data_culto),
          rodizios: rodiziosFormatados
        }
      };
      
      console.log(`📤 [WEBHOOK ENCARREGADOS] Enviando para: ${telefone}`);
      console.log(`📋 [WEBHOOK ENCARREGADOS] Payload:`, JSON.stringify(payload, null, 2));
      
      await axios.post(webhookNotificacao, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      console.log(`✅ [WEBHOOK ENCARREGADOS] Mensagem enviada com sucesso para ${telefone}`);
    } catch (error) {
      console.error(`Erro ao enviar mensagem para encarregado ${telefone}:`, error.message);
    }
  } else {
    console.log(`[SIMULAÇÃO] Mensagem para encarregado ${telefone}:`);
    console.log(mensagemSanitizada);
    console.log('Rodízios:', JSON.stringify(rodiziosFormatados, null, 2));
  }
};

const enviarMensagem = async (telefone, mensagem, dadosRodizio = null) => {
  // Aqui você pode integrar com serviços de SMS/WhatsApp
  // Por exemplo: Twilio, WhatsApp Business API, etc.
  
  const webhookNotificacao = process.env.WEBHOOK_NOTIFICACAO;
  const mensagemSanitizada = removerEmojisAfetivos(mensagem);
  
  if (webhookNotificacao) {
    try {
      // Debug: verificar dados recebidos
      if (dadosRodizio) {
        console.log('[DEBUG] Dados do rodízio recebidos:', {
          organista_nome: dadosRodizio.organista_nome,
          organista_telefone: dadosRodizio.organista_telefone,
          organista_email: dadosRodizio.organista_email,
          funcao: dadosRodizio.funcao
        });
      }
      
      // Preparar payload completo com dados estruturados
      const payload = {
        tipo: 'notificacao_organista',
        timestamp: formatarTimestampBR(),
        timestamp_iso: new Date().toISOString(),
        destinatario: {
          telefone: telefone === 'webhook_organista' ? dadosRodizio?.organista_telefone || null : telefone || null,
          tipo: dadosRodizio ? (
            telefone === 'webhook_organista' || telefone === dadosRodizio.organista_telefone 
              ? 'organista' 
              : telefone === dadosRodizio.encarregado_local_telefone
              ? 'encarregado_local'
              : telefone === dadosRodizio.encarregado_regional_telefone
              ? 'encarregado_regional'
              : 'encarregado'
          ) : 'encarregado'
        },
        mensagem: mensagemSanitizada,
        dados: dadosRodizio ? {
          rodizio_id: dadosRodizio.id,
          organista: {
            nome: dadosRodizio.organista_nome || null,
            telefone: dadosRodizio.organista_telefone || null,
            email: dadosRodizio.organista_email || null
          },
          igreja: {
            nome: dadosRodizio.igreja_nome || null,
            encarregado_local: {
              nome: dadosRodizio.encarregado_local_nome || null,
              telefone: dadosRodizio.encarregado_local_telefone || null
            },
            encarregado_regional: {
              nome: dadosRodizio.encarregado_regional_nome || null,
              telefone: dadosRodizio.encarregado_regional_telefone || null
            }
          },
          culto: {
            data: dadosRodizio.data_culto || null,
            data_formatada: formatarDataBR(dadosRodizio.data_culto),
            dia_semana: dadosRodizio.dia_semana || null,
            hora: dadosRodizio.hora_culto || null,
            funcao: dadosRodizio.funcao || null,
            funcao_texto: dadosRodizio.funcao === 'meia_hora' 
              ? 'Meia Hora (30 min antes do culto)' 
              : 'Tocar no Culto'
          }
        } : null
      };
      
      // Log do payload antes de enviar (para debug)
      console.log(`📤 [WEBHOOK] Enviando para: ${telefone}`);
      console.log(`📋 [WEBHOOK] Payload:`, JSON.stringify(payload, null, 2));
      
      await axios.post(webhookNotificacao, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      console.log(`✅ [WEBHOOK] Mensagem enviada com sucesso para ${telefone}`);
    } catch (error) {
      console.error(`Erro ao enviar mensagem para ${telefone}:`, error.message);
      // Não falha a operação se o webhook falhar
    }
  } else {
    // Se não houver webhook configurado, apenas loga
    console.log(`[SIMULAÇÃO] Mensagem para ${telefone}:`);
    console.log(mensagemSanitizada);
    if (dadosRodizio) {
      console.log('Dados do rodízio:', JSON.stringify(dadosRodizio, null, 2));
    }
    console.log('---');
  }
};

const formatarDataBR = (dataStr) => {
  // Se já for uma string no formato correto, usar diretamente
  if (typeof dataStr === 'string') {
    // Verificar se está no formato YYYY-MM-DD
    if (dataStr.includes('-')) {
      const [ano, mes, dia] = dataStr.split('-');
      return `${dia}/${mes}/${ano}`;
    }
    // Se já estiver formatado, retornar como está
    return dataStr;
  }
  
  // Se for um objeto Date, converter
  if (dataStr instanceof Date) {
    const dia = String(dataStr.getDate()).padStart(2, '0');
    const mes = String(dataStr.getMonth() + 1).padStart(2, '0');
    const ano = dataStr.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
  
  // Se for null ou undefined, retornar string vazia
  if (!dataStr) {
    return '';
  }
  
  // Tentar converter para string
  return String(dataStr);
};

const removerEmojisAfetivos = (mensagem) => {
  if (!mensagem) return mensagem;
  const regexEmojisAfetivos = /(?:\u2764\uFE0F?|\u2665\uFE0F?|\u2763\uFE0F?|\u{1F49A}|\u{1F499}|\u{1F49B}|\u{1F49C}|\u{1F49D}|\u{1F49E}|\u{1F49F}|\u{1F5A4}|\u{1F90D}|\u{1F90E}|\u{1F90F}|\u{1F9E1}|\u{1F494}|\u{1F495}|\u{1F496}|\u{1F497}|\u{1F498})/gu;
  return mensagem.replace(regexEmojisAfetivos, '');
};

module.exports = {
  enviarNotificacaoDiaCulto,
  enviarNotificacaoEncarregados,
  enviarMensagem,
  clearTemplateCache
};
