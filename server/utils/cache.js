/**
 * Cache Simples em Memória
 * Para dados que não mudam frequentemente (igrejas, usuários)
 */

class SimpleCache {
  constructor(defaultTTL = 5 * 60 * 1000) { // 5 minutos padrão
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Obter valor do cache
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Verificar se expirou
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Armazenar valor no cache
   */
  set(key, value, ttl = null) {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Remover do cache
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Limpar cache por padrão (prefixo)
   */
  clearPattern(pattern) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Limpar todo o cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Obter estatísticas do cache
   */
  getStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const item of this.cache.values()) {
      if (now > item.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired
    };
  }

  /**
   * Limpar itens expirados (garbage collection)
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }
}

// Instância global do cache
const cache = new SimpleCache(5 * 60 * 1000); // 5 minutos TTL padrão

// Limpar cache expirado a cada 10 minutos
setInterval(() => {
  const cleaned = cache.cleanup();
  if (cleaned > 0 && process.env.NODE_ENV !== 'production') {
    console.log(`[CACHE] Limpados ${cleaned} itens expirados`);
  }
}, 10 * 60 * 1000);

/**
 * Wrapper para cachear resultados de funções async
 */
async function cached(key, fn, ttl = null) {
  // Tentar obter do cache
  const cached = cache.get(key);
  if (cached !== null) {
    return cached;
  }

  // Executar função e cachear resultado
  const result = await fn();
  cache.set(key, result, ttl);
  return result;
}

/**
 * Invalidar cache por padrão
 */
function invalidate(pattern) {
  cache.clearPattern(pattern);
}

/**
 * Cache específico para metadados de schema (TTL longo: 1 hora)
 * Evita queries repetidas a INFORMATION_SCHEMA
 */
const schemaCache = new SimpleCache(60 * 60 * 1000); // 1 hora

/**
 * Verificar se coluna existe (com cache)
 * @param {string} tableName - Nome da tabela
 * @param {string} columnName - Nome da coluna
 * @returns {Promise<boolean>} - true se coluna existe
 */
async function cachedColumnExists(tableName, columnName) {
  const cacheKey = `schema:${tableName}:${columnName}`;
  const cached = schemaCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }
  
  const db = require('../database/db');
  const pool = db.getDb();
  
  try {
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ? 
        AND COLUMN_NAME = ?
    `, [tableName, columnName]);
    
    const exists = columns.length > 0;
    schemaCache.set(cacheKey, exists);
    return exists;
  } catch (error) {
    // Em caso de erro, assumir que não existe e não cachear
    console.warn(`[CACHE] Erro ao verificar coluna ${tableName}.${columnName}:`, error.message);
    return false;
  }
}

/**
 * Invalidar cache de schema (chamar quando estrutura de tabela mudar)
 */
function invalidateSchemaCache(tableName = null) {
  if (tableName) {
    schemaCache.clearPattern(`schema:${tableName}:`);
  } else {
    schemaCache.clearPattern('schema:');
  }
}

module.exports = {
  cache,
  cached,
  invalidate,
  SimpleCache,
  cachedColumnExists,
  invalidateSchemaCache
};
