const db = require('../database/db');
const axios = require('axios');

// Função para enviar notificação consolidada para encarregados
const enviarNotificacaoEncarregados = async (rodizios, options = {}) => {
  if (!rodizios || rodizios.length === 0) return;
  const referencia = options.referencia || 'hoje';
  
  const primeiroRodizio = rodizios[0];
  
  // Criar mensagem consolidada com todos os rodízios
  let mensagemConsolidada = `📢 Notificação: Organistas escaladas para ${referencia}\n\n`;
  mensagemConsolidada += `📅 Data: ${formatarDataBR(primeiroRodizio.data_culto)}\n`;
  mensagemConsolidada += `📍 Igreja: ${primeiroRodizio.igreja_nome}\n\n`;
  mensagemConsolidada += `🎹 Organistas escaladas:\n\n`;
  
  for (const rodizio of rodizios) {
    const funcaoTexto = rodizio.funcao === 'meia_hora' 
      ? '🎵 Meia Hora (30 min antes do culto)' 
      : '🎹 Tocar no Culto';
    
    const [hora, minuto] = rodizio.hora_culto.split(':');
    const horaMeiaHora = new Date();
    horaMeiaHora.setHours(parseInt(hora), parseInt(minuto) - 30, 0, 0);
    const horaMeiaHoraStr = `${String(horaMeiaHora.getHours()).padStart(2, '0')}:${String(horaMeiaHora.getMinutes()).padStart(2, '0')}`;
    
    mensagemConsolidada += `${funcaoTexto}\n`;
    mensagemConsolidada += `   👤 ${rodizio.organista_nome}\n`;
    mensagemConsolidada += `   📞 ${rodizio.organista_telefone || 'Não informado'}\n`;
    mensagemConsolidada += `   🕐 Hora: ${rodizio.hora_culto}\n`;
    if (rodizio.funcao === 'meia_hora') {
      mensagemConsolidada += `   ⏰ Meia hora: ${horaMeiaHoraStr}\n`;
    }
    mensagemConsolidada += `\n`;
  }
  
  mensagemConsolidada = mensagemConsolidada.trim();
  
  // Preparar payload consolidado com todos os rodízios
  const rodiziosFormatados = rodizios.map(rodizio => {
    const [hora, minuto] = rodizio.hora_culto.split(':');
    const horaMeiaHora = new Date();
    horaMeiaHora.setHours(parseInt(hora), parseInt(minuto) - 30, 0, 0);
    const horaMeiaHoraStr = `${String(horaMeiaHora.getHours()).padStart(2, '0')}:${String(horaMeiaHora.getMinutes()).padStart(2, '0')}`;
    
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
        hora: rodizio.hora_culto || null,
        funcao: rodizio.funcao || null,
        funcao_texto: rodizio.funcao === 'meia_hora' 
          ? 'Meia Hora (30 min antes do culto)' 
          : 'Tocar no Culto',
        hora_meia_hora: rodizio.funcao === 'meia_hora' ? horaMeiaHoraStr : null
      }
    };
  });
  
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
    // Calcular hora da meia hora (30 minutos antes do culto)
    const [hora, minuto] = rodizio.hora_culto.split(':');
    const horaMeiaHora = new Date();
    horaMeiaHora.setHours(parseInt(hora), parseInt(minuto) - 30, 0, 0);
    const horaMeiaHoraStr = `${String(horaMeiaHora.getHours()).padStart(2, '0')}:${String(horaMeiaHora.getMinutes()).padStart(2, '0')}`;
    
    // Determinar função
    const funcaoTexto = rodizio.funcao === 'meia_hora' 
      ? 'Meia hora (30 min antes do culto)' 
      : 'Culto';
    const horaCultoSemSegundos = rodizio.hora_culto
      ? rodizio.hora_culto.split(':').slice(0, 2).join(':')
      : null;
    
    // Mensagem para a organista (tom congregacional e acolhedor)
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
    const mensagemOrganista = removerEmojisAfetivos(linhasMensagem.join('\n'));
    
    // Mensagem para encarregados
    const mensagemEncarregados = `
📢 Notificação: Organista escalada para hoje

🎹 Organista: ${rodizio.organista_nome}
📞 Telefone: ${rodizio.organista_telefone || 'Não informado'}
📅 Data: ${formatarDataBR(rodizio.data_culto)}
🕐 Hora do culto: ${rodizio.hora_culto}
🎯 Função: ${funcaoTexto}
${rodizio.funcao === 'meia_hora' ? `⏰ Horário: ${horaMeiaHoraStr}` : ''}
📍 Igreja: ${rodizio.igreja_nome}
    `.trim();
    
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
  enviarMensagem
};
