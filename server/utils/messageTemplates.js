const TEMPLATE_KEYS = {
  organista: (igrejaId) => `template_mensagem_organista_igreja_${igrejaId}`,
  encarregado: (igrejaId) => `template_mensagem_encarregado_igreja_${igrejaId}`
};

const TEMPLATE_PLACEHOLDERS = [
  { key: 'organista_nome', descricao: 'Nome da organista da escala' },
  { key: 'organista_telefone', descricao: 'Telefone da organista da escala' },
  { key: 'igreja_nome', descricao: 'Nome da igreja' },
  { key: 'data', descricao: 'Data formatada (dd/mm/aaaa)' },
  { key: 'dia_semana', descricao: 'Dia da semana' },
  { key: 'funcao', descricao: 'Funcao da escala (Culto/Meia Hora/RJM)' },
  { key: 'hora', descricao: 'Hora principal da escala (hh:mm)' },
  { key: 'hora_meia_hora', descricao: 'Hora da meia hora (quando aplicavel)' },
  { key: 'referencia', descricao: 'Referencia da notificacao (hoje/amanha)' },
  { key: 'lista_rodizios', descricao: 'Lista consolidada de rodizios para encarregados' }
];

function renderTemplate(template, context = {}) {
  if (!template || typeof template !== 'string') return '';

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = context[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

module.exports = {
  TEMPLATE_KEYS,
  TEMPLATE_PLACEHOLDERS,
  renderTemplate
};
