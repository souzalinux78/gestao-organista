const PDFDocument = require('pdfkit');
const db = require('../database/db');

const gerarPDFRodizio = (rodizios) => {
  return new Promise((resolve, reject) => {
    try {
      if (!rodizios || rodizios.length === 0) {
        return reject(new Error('Nenhum rodízio para gerar PDF'));
      }

      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Cabeçalho
      const igrejaNome = rodizios[0].igreja_nome || 'Igreja';
      doc.fontSize(18).text(`Rodízio de Organistas - ${igrejaNome}`, { align: 'center' });
      doc.moveDown(0.5);

      if (rodizios[0].periodo_inicio && rodizios[0].periodo_fim) {
        doc.fontSize(11).text(
          `Período: ${formatarDataBR(rodizios[0].periodo_inicio)} a ${formatarDataBR(rodizios[0].periodo_fim)}`,
          { align: 'center' }
        );
        doc.moveDown();
      }

      doc.moveDown();

      // --- CONFIGURAÇÃO DA TABELA (Colunas Ajustadas) ---
      let yPos = doc.y;
      const lineHeight = 20;

      // Posições X fixas para alinhamento perfeito
      const colX = {
        data: 40,
        dia: 100,
        hora: 140,
        ciclo: 190,  // Coluna Ciclo separada
        funcao: 240,
        organista: 350
      };

      // Títulos
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Data', colX.data, yPos);
      doc.text('Dia', colX.dia, yPos);
      doc.text('Hora', colX.hora, yPos);
      doc.text('Ciclo', colX.ciclo, yPos);
      doc.text('Função', colX.funcao, yPos);
      doc.text('Organista', colX.organista, yPos);

      yPos += 15;
      doc.moveTo(40, yPos).lineTo(555, yPos).stroke();
      yPos += 10;

      // Dados
      doc.font('Helvetica').fontSize(10);

      rodizios.forEach((rodizio, index) => {
        // Quebra de página
        if (yPos > 730) {
          doc.addPage();
          yPos = 50;
          // Repete cabeçalho
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('Data', colX.data, yPos);
          doc.text('Dia', colX.dia, yPos);
          doc.text('Hora', colX.hora, yPos);
          doc.text('Ciclo', colX.ciclo, yPos);
          doc.text('Função', colX.funcao, yPos);
          doc.text('Organista', colX.organista, yPos);
          yPos += 15;
          doc.moveTo(40, yPos).lineTo(555, yPos).stroke();
          yPos += 10;
          doc.font('Helvetica').fontSize(10);
        }

        // Zebra
        if (index % 2 === 0) {
          doc.save();
          doc.fillColor('#f5f5f5');
          doc.rect(40, yPos - 4, 515, lineHeight).fill();
          doc.restore();
        }

        const dataFormatada = formatarDataBR(rodizio.data_culto);
        const diaFormatado = formatarDiaSemana(rodizio.dia_semana || '');
        let horaFormatada = rodizio.hora_culto || rodizio.hora || '-';
        if (horaFormatada.includes(':')) horaFormatada = horaFormatada.substring(0, 5);

        const isRJM = rodizio.culto_tipo === 'rjm' || rodizio.eh_rjm === 1;
        const funcaoTexto = rodizio.funcao === 'meia_hora' ? 'Meia Hora' : (isRJM ? 'RJM' : 'Culto');

        // CORREÇÃO VISUAL: Garante que o ciclo apareça limpo
        const cicloVal = rodizio.ciclo_nome || rodizio.ciclo || rodizio.ciclo_origem || '-';

        // Remove "(Ciclo X)" do nome para não duplicar
        let organistaNome = rodizio.organista_nome || '';
        organistaNome = organistaNome.replace(/\s*\(Ciclo \d+\)/gi, '').trim();

        doc.fillColor('black');
        doc.text(dataFormatada, colX.data, yPos);
        doc.text(diaFormatado, colX.dia, yPos);
        doc.text(horaFormatada, colX.hora, yPos);
        doc.text(String(cicloVal), colX.ciclo, yPos); // Nome do Ciclo
        doc.text(funcaoTexto, colX.funcao, yPos);
        doc.text(organistaNome, colX.organista, yPos);

        yPos += lineHeight;
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const formatarDataBR = (dataStr) => {
  if (!dataStr) return '';
  try {
    const data = new Date(dataStr);
    if (isNaN(data.getTime())) return String(dataStr);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  } catch (e) { return String(dataStr); }
};

const formatarDiaSemana = (dia) => {
  const map = { 'domingo': 'Dom', 'segunda': 'Seg', 'terça': 'Ter', 'quarta': 'Qua', 'quinta': 'Qui', 'sexta': 'Sex', 'sábado': 'Sáb' };
  return map[String(dia).toLowerCase()] || dia;
};

// Mantém export da função escala para não quebrar
const gerarPDFEscala = gerarPDFRodizio;

module.exports = { gerarPDFRodizio, gerarPDFEscala };