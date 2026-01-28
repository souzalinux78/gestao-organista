/**
 * Middleware de Tratamento de Erros Centralizado
 * Padroniza respostas de erro e logging
 */

/**
 * Classe de erro customizada para a aplicação
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Erros operacionais (não programação)
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Trata erros do MySQL
 */
function handleMySQLError(error) {
  // Timeout
  if (error.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || error.code === 'ETIMEDOUT') {
    return new AppError(
      'Banco de dados demorou para responder. Tente novamente em instantes.',
      503,
      'DB_TIMEOUT'
    );
  }

  // Conexão recusada
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new AppError(
      'Não foi possível conectar ao banco de dados. Tente novamente em instantes.',
      503,
      'DB_CONNECTION_ERROR'
    );
  }

  // Erro de conexão resetada
  if (error.code === 'ECONNRESET') {
    return new AppError(
      'Conexão com banco de dados foi perdida. Tente novamente.',
      503,
      'DB_CONNECTION_RESET'
    );
  }

  // Duplicata (constraint unique)
  if (error.code === 'ER_DUP_ENTRY') {
    let message = 'Já existe um registro com esses dados.';
    
    // Tentar extrair informação útil da mensagem
    if (error.message.includes('unique_organistas_ordem')) {
      message = 'Já existe uma organista com essa ordem. Escolha outra ordem.';
    } else if (error.message.includes('unique_organistas_igreja_ordem')) {
      message = 'Já existe uma organista com essa ordem nesta igreja. Escolha outra ordem.';
    } else if (error.message.includes('email')) {
      message = 'Email já cadastrado.';
    }
    
    return new AppError(message, 400, 'DUPLICATE_ENTRY', error.message);
  }

  // Foreign key constraint
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return new AppError(
      'Referência inválida. Verifique se os dados relacionados existem.',
      400,
      'FOREIGN_KEY_ERROR'
    );
  }

  // Campo não encontrado (migração pendente)
  if (error.code === 'ER_BAD_FIELD_ERROR') {
    return new AppError(
      'Campo não encontrado no banco de dados. Pode ser necessário executar migrações.',
      500,
      'FIELD_NOT_FOUND',
      error.message
    );
  }

  // Retornar erro genérico do MySQL
  return new AppError(
    'Erro no banco de dados',
    500,
    'DB_ERROR',
    process.env.NODE_ENV === 'development' ? error.message : undefined
  );
}

/**
 * Trata erros de JWT
 */
function handleJWTError(error) {
  if (error.name === 'TokenExpiredError') {
    return new AppError('Token expirado', 401, 'TOKEN_EXPIRED');
  }
  if (error.name === 'JsonWebTokenError') {
    return new AppError('Token inválido', 401, 'TOKEN_INVALID');
  }
  return new AppError('Erro na autenticação', 401, 'AUTH_ERROR');
}

/**
 * Middleware de tratamento de erros
 * Deve ser o ÚLTIMO middleware registrado
 */
function errorHandler(error, req, res, next) {
  let appError = error;

  // Se não for AppError, converter
  if (!(error instanceof AppError)) {
    // Erros do MySQL
    if (error.code && error.code.startsWith('ER_') || 
        error.code === 'PROTOCOL_SEQUENCE_TIMEOUT' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET') {
      appError = handleMySQLError(error);
    }
    // Erros de JWT
    else if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      appError = handleJWTError(error);
    }
    // Erros de validação (do middleware de validação)
    else if (error.name === 'ValidationError') {
      appError = new AppError(error.message, 400, 'VALIDATION_ERROR', error.details);
    }
    // Erros desconhecidos
    else {
      // Logar erro completo em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('[ERROR] Erro não tratado:', {
          message: error.message,
          stack: error.stack,
          code: error.code,
          name: error.name
        });
      }
      
      appError = new AppError(
        'Erro interno do servidor',
        500,
        'INTERNAL_ERROR',
        process.env.NODE_ENV === 'development' ? error.message : undefined
      );
    }
  }

  // Log do erro (em produção, usar logger estruturado)
  if (process.env.NODE_ENV !== 'production' || appError.statusCode >= 500) {
    console.error(`[ERROR] ${appError.statusCode} - ${appError.message}`, {
      code: appError.code,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      details: appError.details
    });
  }

  // Resposta padronizada
  const response = {
    error: appError.message,
    ...(appError.code && { code: appError.code }),
    ...(appError.details && { details: appError.details })
  };

  res.status(appError.statusCode).json(response);
}

/**
 * Middleware para capturar erros 404 (rota não encontrada)
 */
function notFoundHandler(req, res, next) {
  const error = new AppError(
    `Rota ${req.method} ${req.path} não encontrada`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
}

/**
 * Wrapper para rotas async (evita try/catch em cada rota)
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleMySQLError,
  handleJWTError
};
