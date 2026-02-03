const cron = require('node-cron');
const db = require('../database/db');
const notificacaoService = require('./notificacaoService');

// Executar todos os dias às 10:00
const init = () => {
  console.log('Inicializando agendador de notificações...');
  
  // Verificar rodízios do dia às 10:00
  cron.schedule('0 10 * * *', async () => {
    console.log('Verificando rodízios do dia para envio de notificações...');
    await verificarERodiziosDoDia();
  });
  
  console.log('Agendador configurado: verificação diária às 10:00');
};

const verificarERodiziosDoDia = async () => {
  try {
    const pool = db.getDb();
    const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const [rodizios] = await pool.execute(
      `SELECT r.*, 
              o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
              i.nome as igreja_nome,
              i.encarregado_local_nome, i.encarregado_local_telefone,
              i.encarregado_regional_nome, i.encarregado_regional_telefone,
              i.contato_aviso_escala_telefone,
              c.dia_semana, c.hora as hora_culto, r.funcao
       FROM rodizios r
       INNER JOIN organistas o ON r.organista_id = o.id
       INNER JOIN igrejas i ON r.igreja_id = i.id
       INNER JOIN cultos c ON r.culto_id = c.id
       WHERE r.data_culto = ?
       AND NOT EXISTS (
         SELECT 1 FROM notificacoes n 
         WHERE n.rodizio_id = r.id 
         AND n.tipo = 'alerta_dia_culto'
         AND DATE(n.created_at) = CURDATE()
       )`,
      [hoje]
    );
    
    if (rodizios.length === 0) {
      console.log('Nenhum rodízio encontrado para hoje');
      return;
    }
    
    console.log(`✅ Encontrados ${rodizios.length} rodízio(s) para hoje às 10:00`);
    
    // Separar rodízios por função para melhor visualização
    const rodiziosMeiaHora = rodizios.filter(r => r.funcao === 'meia_hora');
    const rodiziosTocarCulto = rodizios.filter(r => r.funcao === 'tocar_culto');
    
    if (rodiziosMeiaHora.length > 0) {
      console.log(`🎵 Organistas para Meia Hora: ${rodiziosMeiaHora.length}`);
    }
    if (rodiziosTocarCulto.length > 0) {
      console.log(`🎹 Organistas para Tocar no Culto: ${rodiziosTocarCulto.length}`);
    }
    
    // Agrupar rodízios por igreja para evitar envios duplicados para encarregados
    const rodiziosPorIgreja = {};
    for (const rodizio of rodizios) {
      const igrejaId = rodizio.igreja_id;
      if (!rodiziosPorIgreja[igrejaId]) {
        rodiziosPorIgreja[igrejaId] = [];
      }
      rodiziosPorIgreja[igrejaId].push(rodizio);
    }
    
    // Processar cada igreja separadamente
    for (const [igrejaId, rodiziosIgreja] of Object.entries(rodiziosPorIgreja)) {
      console.log(`\n📋 Processando igreja ID: ${igrejaId} - ${rodiziosIgreja.length} rodízio(s)`);
      
      // Enviar webhook para cada organista (1 por rodízio)
      const telefonesEnviados = new Set(); // Para evitar duplicatas
      
      for (const rodizio of rodiziosIgreja) {
        try {
          const funcaoTexto = rodizio.funcao === 'meia_hora' ? '🎵 Meia Hora' : '🎹 Tocar no Culto';
          console.log(`📤 Processando: ${funcaoTexto} - Organista: ${rodizio.organista_nome} (ID: ${rodizio.id})`);
          
          // Enviar webhook para a organista (apenas 1x por organista/rodízio)
          await notificacaoService.enviarNotificacaoDiaCulto(rodizio, false); // false = não enviar para encarregados ainda
          console.log(`✅ Webhook enviado para organista: ${rodizio.organista_nome} - ${funcaoTexto}`);
          
          // Registrar telefone da organista para evitar duplicatas
          if (rodizio.organista_telefone) {
            telefonesEnviados.add(rodizio.organista_telefone);
          }
        } catch (error) {
          console.error(`❌ Erro ao enviar notificação para rodízio ID ${rodizio.id}:`, error);
        }
      }
      
      // Enviar 1 webhook consolidado para encarregados (com todos os rodízios do dia)
      if (rodiziosIgreja.length > 0) {
        const primeiroRodizio = rodiziosIgreja[0];
        try {
          await notificacaoService.enviarNotificacaoEncarregados(rodiziosIgreja);
          console.log(`✅ Webhook consolidado enviado para encarregados da igreja: ${primeiroRodizio.igreja_nome}`);
        } catch (error) {
          console.error(`❌ Erro ao enviar webhook para encarregados:`, error);
        }
      }
    }
    
    console.log(`\n✅ Processamento concluído: ${rodizios.length} rodízio(s) processado(s)`);
    console.log(`   - ${rodiziosMeiaHora.length} para Meia Hora`);
    console.log(`   - ${rodiziosTocarCulto.length} para Tocar no Culto`);
  } catch (error) {
    console.error('Erro ao buscar rodízios do dia:', error);
  }
};

module.exports = {
  init
};
