/**
 * Helpers para manipulação de datas no frontend
 * Padronização para formato brasileiro: dd/mm/yyyy
 */

/**
 * Converte data do formato brasileiro (dd/mm/yyyy) para formato ISO (YYYY-MM-DD)
 * @param {string} dataBrasileira - Data no formato dd/mm/yyyy
 * @returns {string} Data no formato YYYY-MM-DD
 */
export function parseDataBrasileira(dataBrasileira) {
  if (!dataBrasileira) return null;
  
  const partes = dataBrasileira.split('/');
  if (partes.length !== 3) {
    throw new Error('Data inválida. Use o formato dd/mm/yyyy');
  }
  
  const [dia, mes, ano] = partes;
  
  // Validar números
  const diaNum = parseInt(dia, 10);
  const mesNum = parseInt(mes, 10);
  const anoNum = parseInt(ano, 10);
  
  if (isNaN(diaNum) || isNaN(mesNum) || isNaN(anoNum)) {
    throw new Error('Data inválida. Use apenas números no formato dd/mm/yyyy');
  }
  
  // Validar ranges
  if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12 || anoNum < 1900 || anoNum > 2100) {
    throw new Error('Data inválida. Verifique dia, mês e ano');
  }
  
  return `${anoNum}-${String(mesNum).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;
}

/**
 * Converte data do formato ISO (YYYY-MM-DD) para formato brasileiro (dd/mm/yyyy)
 * @param {string} dataISO - Data no formato YYYY-MM-DD ou ISO string
 * @returns {string} Data no formato dd/mm/yyyy
 */
export function formatarDataBrasileira(dataISO) {
  if (!dataISO) return '-';
  
  try {
    let data;
    
    // Se for string ISO (com T e Z)
    if (typeof dataISO === 'string' && dataISO.includes('T')) {
      data = new Date(dataISO);
      if (isNaN(data.getTime())) {
        // Tentar parsear formato YYYY-MM-DD
        const partes = dataISO.split('T')[0].split('-');
        if (partes.length === 3) {
          const [ano, mes, dia] = partes;
          return `${dia}/${mes}/${ano}`;
        }
        return dataISO;
      }
    } else if (typeof dataISO === 'string' && dataISO.includes('-') && !dataISO.includes('T')) {
      // Formato YYYY-MM-DD
      const [ano, mes, dia] = dataISO.split('-');
      if (ano && mes && dia) {
        return `${dia}/${mes}/${ano}`;
      }
      return dataISO;
    } else if (dataISO instanceof Date) {
      data = dataISO;
    } else {
      return dataISO;
    }
    
    if (isNaN(data.getTime())) {
      return dataISO;
    }
    
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    
    return `${dia}/${mes}/${ano}`;
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return dataISO;
  }
}

/**
 * Aplica máscara de data brasileira (dd/mm/yyyy) em input
 * @param {string} valor - Valor do input
 * @returns {string} Valor com máscara aplicada
 */
export function aplicarMascaraData(valor) {
  if (!valor) return '';
  
  // Remover tudo que não é número
  const numeros = valor.replace(/\D/g, '');
  
  // Limitar a 8 dígitos (ddmmyyyy)
  const limitado = numeros.slice(0, 8);
  
  // Aplicar máscara
  if (limitado.length <= 2) {
    return limitado;
  } else if (limitado.length <= 4) {
    return `${limitado.slice(0, 2)}/${limitado.slice(2)}`;
  } else {
    return `${limitado.slice(0, 2)}/${limitado.slice(2, 4)}/${limitado.slice(4)}`;
  }
}

/**
 * Valida data no formato brasileiro
 * @param {string} dataBrasileira - Data no formato dd/mm/yyyy
 * @returns {boolean} true se válida
 */
export function validarDataBrasileira(dataBrasileira) {
  if (!dataBrasileira) return false;
  
  const partes = dataBrasileira.split('/');
  if (partes.length !== 3) return false;
  
  const [dia, mes, ano] = partes.map(Number);
  
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return false;
  if (dia < 1 || dia > 31) return false;
  if (mes < 1 || mes > 12) return false;
  if (ano < 1900 || ano > 2100) return false;
  
  // Validar data real (ex: 31/02 não existe)
  const data = new Date(ano, mes - 1, dia);
  return data.getDate() === dia && data.getMonth() === mes - 1 && data.getFullYear() === ano;
}

/**
 * Obtém data atual no formato brasileiro
 * @returns {string} Data atual em dd/mm/yyyy
 */
export function obterDataAtualBrasileira() {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  return `${dia}/${mes}/${ano}`;
}
