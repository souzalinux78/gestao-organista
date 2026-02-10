const axios = require('axios');

const enviarRodizio = async (rodizios) => {
  const webhookUrl = process.env.WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('WEBHOOK_URL não configurado, pulando envio de webhook');
    return;
  }
  
  if (!rodizios || rodizios.length === 0) {
    console.log('Nenhum rodízio para enviar');
    return;
  }
  
  try {
    // Formatar dados para o webhook
    const dados = rodizios.map(rodizio => ({
      id: rodizio.id,
      igreja: rodizio.igreja_nome,
      organista: rodizio.organista_nome,
      data_culto: rodizio.data_culto,
      dia_semana: rodizio.dia_semana,
      hora_culto: rodizio.hora_culto,
      periodo_inicio: rodizio.periodo_inicio,
      periodo_fim: rodizio.periodo_fim
    }));
    
    const payload = {
      tipo: 'rodizio_gerado',
      total: rodizios.length,
      periodo: {
        inicio: rodizios[0].periodo_inicio,
        fim: rodizios[0].periodo_fim
      },
      igreja: rodizios[0].igreja_nome,
      rodizios: dados
    };
    
    await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`Webhook enviado com sucesso: ${rodizios.length} rodízios`);
  } catch (error) {
    console.error('Erro ao enviar webhook:', error.message);
    throw error;
  }
};

module.exports = {
  enviarRodizio
};
