/**
 * Utilitário para Mensagens de Erro Amigáveis
 * Traduz códigos de erro técnicos em mensagens compreensíveis
 */

/**
 * Mapeia códigos de erro para mensagens amigáveis
 */
const errorMessages = {
  // Autenticação
  'INVALID_CREDENTIALS': 'Email ou senha incorretos. Verifique suas credenciais e tente novamente.',
  'TOKEN_EXPIRED': 'Sua sessão expirou. Por favor, faça login novamente.',
  'TOKEN_INVALID': 'Sessão inválida. Por favor, faça login novamente.',
  'USER_INACTIVE': 'Sua conta está inativa. Entre em contato com o administrador.',
  'USER_NOT_APPROVED': 'Sua conta ainda não foi aprovada. Aguarde a aprovação do administrador.',
  
  // Banco de dados
  'DB_TIMEOUT': 'O servidor demorou para responder. Tente novamente em alguns instantes.',
  'DB_CONNECTION_ERROR': 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  'DB_CONNECTION_RESET': 'Conexão com o servidor foi perdida. Tente novamente.',
  'DB_ERROR': 'Erro ao processar sua solicitação. Tente novamente mais tarde.',
  
  // Validação
  'VALIDATION_ERROR': 'Dados inválidos. Verifique os campos e tente novamente.',
  'DUPLICATE_ENTRY': 'Já existe um registro com esses dados. Verifique as informações.',
  'FIELD_NOT_FOUND': 'Erro interno. Entre em contato com o suporte.',
  
  // Acesso
  'ROUTE_NOT_FOUND': 'Página não encontrada.',
  'ACCESS_DENIED': 'Você não tem permissão para realizar esta ação.',
  
  // Rede
  'NETWORK_ERROR': 'Erro de conexão. Verifique sua internet e tente novamente.',
  'TIMEOUT_ERROR': 'Tempo limite excedido. O servidor demorou para responder.',
  'SERVER_ERROR': 'Servidor temporariamente indisponível. Tente novamente em alguns instantes.',
  
  // Genérico
  'INTERNAL_ERROR': 'Erro interno do servidor. Tente novamente mais tarde.',
  'UNKNOWN_ERROR': 'Ocorreu um erro inesperado. Tente novamente.'
};

/**
 * Obtém mensagem amigável de erro
 */
export function getErrorMessage(error) {
  // Se for string, retornar direto
  if (typeof error === 'string') {
    return errorMessages[error] || error;
  }

  // Se for objeto de erro da API
  if (error?.response?.data) {
    const data = error.response.data;
    
    // Tentar código de erro
    if (data.code && errorMessages[data.code]) {
      return errorMessages[data.code];
    }
    
    // Tentar mensagem de erro
    if (data.error) {
      return data.error;
    }
    
    // Tentar array de erros (validação)
    if (Array.isArray(data.errors)) {
      return data.errors.join('. ');
    }
  }

  // Erro de timeout
  if (error?.isTimeout || error?.code === 'ECONNABORTED') {
    return errorMessages.TIMEOUT_ERROR;
  }

  // Erro de rede
  if (error?.isNetworkError || !error?.response) {
    return errorMessages.NETWORK_ERROR;
  }

  // Erro de servidor
  if (error?.isServerError || error?.response?.status >= 500) {
    return errorMessages.SERVER_ERROR;
  }

  // Status HTTP específicos
  if (error?.response?.status === 401) {
    return errorMessages.TOKEN_EXPIRED;
  }

  if (error?.response?.status === 403) {
    return errorMessages.ACCESS_DENIED;
  }

  if (error?.response?.status === 404) {
    return errorMessages.ROUTE_NOT_FOUND;
  }

  // Mensagem padrão
  return errorMessages.UNKNOWN_ERROR;
}

/**
 * Obtém título do erro baseado no tipo
 */
export function getErrorTitle(error) {
  if (error?.response?.status === 401) {
    return 'Sessão Expirada';
  }
  
  if (error?.response?.status === 403) {
    return 'Acesso Negado';
  }
  
  if (error?.response?.status === 404) {
    return 'Não Encontrado';
  }
  
  if (error?.response?.status >= 500 || error?.isServerError) {
    return 'Erro do Servidor';
  }
  
  if (error?.isNetworkError || !error?.response) {
    return 'Erro de Conexão';
  }
  
  return 'Erro';
}

/**
 * Verifica se erro é recuperável (pode tentar novamente)
 */
export function isRecoverableError(error) {
  // Erros de rede/timeout são recuperáveis
  if (error?.isNetworkError || error?.isTimeout || error?.isServerError) {
    return true;
  }
  
  // Erros 5xx são recuperáveis
  if (error?.response?.status >= 500) {
    return true;
  }
  
  // Erros de validação não são recuperáveis (precisa corrigir dados)
  if (error?.response?.status === 400) {
    return false;
  }
  
  // Erros de autenticação não são recuperáveis (precisa fazer login)
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return false;
  }
  
  return false;
}

const errorMessagesUtils = {
  getErrorMessage,
  getErrorTitle,
  isRecoverableError,
  errorMessages
};

export default errorMessagesUtils;
