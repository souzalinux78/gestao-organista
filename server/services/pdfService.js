const PDFDocument = require('pdfkit');
const db = require('../database/db');

const gerarPDFRodizio = (rodizios) => {
  return new Promise((resolve, reject) => {
    try {
      if (!rodizios || rodizios.length === 0) {
        return reject(new Error('Nenhum rodízio para gerar PDF'));
      }
      
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Cabeçalho
      const igrejaNome = rodizios[0].igreja_nome;
      doc.fontSize(20).text(`Rodízio de Organistas - ${igrejaNome}`, { align: 'center' });
      doc.moveDown();
      
      // Período
      if (rodizios[0].periodo_inicio && rodizios[0].periodo_fim) {
        doc.fontSize(12).text(
          `Período: ${formatarDataBR(rodizios[0].periodo_inicio)} a ${formatarDataBR(rodizios[0].periodo_fim)}`,
          { align: 'center' }
        );
        doc.moveDown();
      }
      
      doc.moveDown();
      
      // Tabela
      let yPos = doc.y;
      const lineHeight = 20;
      const colWidths = { data: 100, dia: 80, hora: 80, organista: 250 };
      
      // Cabeçalho da tabela
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Data', 50, yPos);
      doc.text('Dia', 50 + colWidths.data, yPos);
      doc.text('Hora', 50 + colWidths.data + colWidths.dia, yPos);
      doc.text('Função', 50 + colWidths.data + colWidths.dia + colWidths.hora, yPos);
      doc.text('Organista', 50 + colWidths.data + colWidths.dia + colWidths.hora + 80, yPos);
      
      yPos += lineHeight;
      doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
      yPos += 5;
      
      // Dados
      doc.font('Helvetica');
      rodizios.forEach(rodizio => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        
        const dataFormatada = formatarDataBR(rodizio.data_culto);
        const diaFormatado = formatarDiaSemana(rodizio.dia_semana || '');
        // Formatar hora para HH:MM (remover segundos se existirem)
        let horaFormatada = rodizio.hora_culto || rodizio.hora || '';
        if (horaFormatada && horaFormatada.includes(':')) {
          const partes = horaFormatada.split(':');
          horaFormatada = `${partes[0]}:${partes[1]}`;
        }
        const funcaoTexto = rodizio.funcao === 'meia_hora' ? 'Meia Hora' : 'Tocar no Culto';
        const organistaNome = rodizio.organista_nome || 'Não definido';
        
        doc.fontSize(9).text(dataFormatada, 50, yPos);
        doc.text(diaFormatado, 50 + colWidths.data, yPos);
        doc.text(horaFormatada, 50 + colWidths.data + colWidths.dia, yPos);
        doc.text(funcaoTexto, 50 + colWidths.data + colWidths.dia + colWidths.hora, yPos);
        doc.text(organistaNome, 50 + colWidths.data + colWidths.dia + colWidths.hora + 80, yPos);
        
        yPos += lineHeight;
      });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const formatarDataBR = (dataStr) => {
  if (!dataStr) return 'Data não informada';
  
  try {
    // Se for uma string ISO (com T e Z)
    if (typeof dataStr === 'string' && dataStr.includes('T')) {
      const data = new Date(dataStr);
      if (!isNaN(data.getTime())) {
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        return `${dia}/${mes}/${ano}`;
      }
      // Tentar parsear formato YYYY-MM-DDTHH:MM:SS
      const partes = dataStr.split('T')[0].split('-');
      if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
    }
    
    // Se já está no formato YYYY-MM-DD
    if (typeof dataStr === 'string' && dataStr.includes('-') && !dataStr.includes('T')) {
      const [ano, mes, dia] = dataStr.split('-');
      if (ano && mes && dia) {
        return `${dia}/${mes}/${ano}`;
      }
    }
    
    // Se é um objeto Date
    if (dataStr instanceof Date) {
      const dia = String(dataStr.getDate()).padStart(2, '0');
      const mes = String(dataStr.getMonth() + 1).padStart(2, '0');
      const ano = dataStr.getFullYear();
      return `${dia}/${mes}/${ano}`;
    }
    
    return String(dataStr);
  } catch (error) {
    console.error('Erro ao formatar data no PDF:', error, dataStr);
    return String(dataStr);
  }
};

const formatarDiaSemana = (diaSemana) => {
  const dias = {
    'domingo': 'Dom',
    'segunda': 'Seg',
    'terça': 'Ter',
    'quarta': 'Qua',
    'quinta': 'Qui',
    'sexta': 'Sex',
    'sábado': 'Sáb'
  };
  return dias[diaSemana.toLowerCase()] || diaSemana;
};

module.exports = {
  gerarPDFRodizio
};
