const db = require('../database/db');
const axios = require('axios');

// Função para enviar notificação consolidada para encarregados
const enviarNotificacaoEncarregados = async (rodizios) => {
  if (!rodizios || rodizios.length === 0) return;
  
  const primeiroRodizio = rodizios[0];
  
  // Criar mensagem consolidada com todos os rodízios
  let mensagemConsolidada = `📢 Notificação: Organistas escaladas para hoje\n\n`;
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

const enviarNotificacaoDiaCulto = async (rodizio, enviarParaEncarregados = false) => {
  const pool = db.getDb();
  
  try {
    // Calcular hora da meia hora (30 minutos antes do culto)
    const [hora, minuto] = rodizio.hora_culto.split(':');
    const horaMeiaHora = new Date();
    horaMeiaHora.setHours(parseInt(hora), parseInt(minuto) - 30, 0, 0);
    const horaMeiaHoraStr = `${String(horaMeiaHora.getHours()).padStart(2, '0')}:${String(horaMeiaHora.getMinutes()).padStart(2, '0')}`;
    
    // Determinar função
    const funcaoTexto = rodizio.funcao === 'meia_hora' 
      ? '🎵 Meia Hora (30 min antes do culto)' 
      : '🎹 Tocar no Culto';
    
    // Mensagem para a organista
    const mensagemOrganista = `
🎹 Lembrete: Você está escalada para hoje!

📅 Data: ${formatarDataBR(rodizio.data_culto)}
🕐 Hora do culto: ${rodizio.hora_culto}
🎯 Função: ${funcaoTexto}
${rodizio.funcao === 'meia_hora' ? `⏰ Horário: ${horaMeiaHoraStr}` : ''}
📍 Igreja: ${rodizio.igreja_nome}

${rodizio.funcao === 'meia_hora' 
  ? 'Por favor, esteja presente 30 minutos antes do culto para a meia hora.' 
  : 'Por favor, esteja presente para tocar durante o culto.'}
    `.trim();
    
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
    
    // Enviar webhook APENAS para a organista (1 webhook por organista/rodízio)
    const telefoneOrganista = rodizio.organista_telefone || 'webhook_organista';
    await enviarMensagem(telefoneOrganista, mensagemOrganista, rodizio);
    console.log(`✅ Webhook disparado para organista: ${rodizio.organista_nome} (${rodizio.funcao === 'meia_hora' ? 'Meia Hora' : 'Tocar no Culto'})`);
    
    // NÃO enviar para encarregados aqui - será enviado consolidado depois
    
    // Registrar notificação no banco
    // Formatar data para MySQL (YYYY-MM-DD HH:MM:SS)
    const agora = new Date();
    const dataEnvioMySQL = agora.toISOString().slice(0, 19).replace('T', ' ');
    
    await pool.execute(
      'INSERT INTO notificacoes (rodizio_id, tipo, enviada, data_envio) VALUES (?, ?, ?, ?)',
      [rodizio.id, 'alerta_dia_culto', 1, dataEnvioMySQL]
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
        mensagem: mensagem,
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
    console.log(mensagem);
    console.log('Rodízios:', JSON.stringify(rodiziosFormatados, null, 2));
  }
};

const enviarMensagem = async (telefone, mensagem, dadosRodizio = null) => {
  // Aqui você pode integrar com serviços de SMS/WhatsApp
  // Por exemplo: Twilio, WhatsApp Business API, etc.
  
  const webhookNotificacao = process.env.WEBHOOK_NOTIFICACAO;
  
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
        mensagem: mensagem,
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
    console.log(mensagem);
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

module.exports = {
  enviarNotificacaoDiaCulto,
  enviarNotificacaoEncarregados,
  enviarMensagem
};
