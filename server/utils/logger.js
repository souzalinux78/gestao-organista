/**
 * Logger Estruturado
 * Substitui console.log por logging estruturado
 * Em produção, pode ser integrado com serviços como Winston, Pino, etc.
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG'
};

// Nível de log baseado no ambiente
const getLogLevel = () => {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return LOG_LEVELS[envLevel];
  }
  return process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
};

const currentLogLevel = getLogLevel();

/**
 * Formata timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Formata mensagem de log
 */
function formatLog(level, message, meta = {}) {
  const timestamp = getTimestamp();
  const levelName = LOG_LEVEL_NAMES[level];
  
  const logEntry = {
    timestamp,
    level: levelName,
    message,
    ...meta
  };

  // Em produção, pode ser enviado para serviço de logging
  if (process.env.NODE_ENV === 'production') {
    // Aqui pode integrar com Winston, Pino, CloudWatch, etc.
    // Por enquanto, apenas console estruturado
  }

  return logEntry;
}

/**
 * Logger principal
 */
const logger = {
  /**
   * Log de erro
   */
  error(message, meta = {}) {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      const entry = formatLog(LOG_LEVELS.ERROR, message, meta);
      console.error(`[${entry.timestamp}] [ERROR] ${entry.message}`, entry);
    }
  },

  /**
   * Log de aviso
   */
  warn(message, meta = {}) {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      const entry = formatLog(LOG_LEVELS.WARN, message, meta);
      console.warn(`[${entry.timestamp}] [WARN] ${entry.message}`, entry);
    }
  },

  /**
   * Log de informação
   */
  info(message, meta = {}) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      const entry = formatLog(LOG_LEVELS.INFO, message, meta);
      console.log(`[${entry.timestamp}] [INFO] ${entry.message}`, entry);
    }
  },

  /**
   * Log de debug (apenas em desenvolvimento)
   */
  debug(message, meta = {}) {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      const entry = formatLog(LOG_LEVELS.DEBUG, message, meta);
      console.log(`[${entry.timestamp}] [DEBUG] ${entry.message}`, entry);
    }
  },

  /**
   * Log de requisição HTTP
   */
  http(req, res, responseTime) {
    const meta = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId: req.user?.id,
      ip: req.ip || req.connection.remoteAddress
    };

    if (res.statusCode >= 500) {
      this.error(`${req.method} ${req.path} - ${res.statusCode}`, meta);
    } else if (res.statusCode >= 400) {
      this.warn(`${req.method} ${req.path} - ${res.statusCode}`, meta);
    } else {
      this.info(`${req.method} ${req.path} - ${res.statusCode}`, meta);
    }
  }
};

module.exports = logger;
