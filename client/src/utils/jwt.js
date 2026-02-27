/**
 * Utilitário para manipulação de JWT no Frontend
 * Decodifica e verifica expiração sem validar assinatura (feito no backend)
 */

/**
 * Decodifica JWT sem verificar assinatura
 * Retorna payload ou null se inválido
 */
export function decodeJWT(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decodificar payload (segunda parte)
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    
    return decoded;
  } catch (error) {
    console.error('[JWT] Erro ao decodificar token:', error);
    return null;
  }
}

/**
 * Verifica se token está expirado
 */
export function isTokenExpired(token) {
  const decoded = decodeJWT(token);
  
  if (!decoded || !decoded.exp) {
    return true; // Considera expirado se não tem exp
  }

  // exp está em segundos, Date.now() está em milissegundos
  const expirationTime = decoded.exp * 1000;
  const now = Date.now();
  
  // Adicionar margem de segurança de 5 minutos
  const margin = 5 * 60 * 1000; // 5 minutos
  
  return now >= (expirationTime - margin);
}

/**
 * Verifica se token é válido (não expirado e tem estrutura correta)
 */
export function isTokenValid(token) {
  if (!token) {
    return false;
  }

  const decoded = decodeJWT(token);
  
  if (!decoded) {
    return false;
  }

  // Verificar se tem campos essenciais
  if (!decoded.userId || !decoded.exp) {
    return false;
  }

  // Verificar expiração
  return !isTokenExpired(token);
}

/**
 * Obtém tempo restante até expiração (em milissegundos)
 */
export function getTokenTimeRemaining(token) {
  const decoded = decodeJWT(token);
  
  if (!decoded || !decoded.exp) {
    return 0;
  }

  const expirationTime = decoded.exp * 1000;
  const now = Date.now();
  const remaining = expirationTime - now;
  
  return Math.max(0, remaining);
}

/**
 * Obtém informações do token (userId, role, etc.)
 */
export function getTokenInfo(token) {
  const decoded = decodeJWT(token);
  
  if (!decoded) {
    return null;
  }

  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    tipo_usuario: decoded.tipo_usuario,
    exp: decoded.exp,
    iat: decoded.iat
  };
}

const jwtUtils = {
  decodeJWT,
  isTokenExpired,
  isTokenValid,
  getTokenTimeRemaining,
  getTokenInfo
};

export default jwtUtils;
