/**
 * Validação de Variáveis de Ambiente
 * Garante que todas as variáveis críticas estão configuradas
 */

require('dotenv').config();

const requiredEnvVars = {
  // Segurança - CRÍTICO
  JWT_SECRET: {
    name: 'JWT_SECRET',
    description: 'Chave secreta para assinatura de tokens JWT',
    critical: true
  },
  DB_PASSWORD: {
    name: 'DB_PASSWORD',
    description: 'Senha do banco de dados MySQL',
    critical: true
  },
  // Opcionais mas recomendadas
  DB_HOST: {
    name: 'DB_HOST',
    description: 'Host do banco de dados',
    default: 'localhost',
    critical: false
  },
  DB_USER: {
    name: 'DB_USER',
    description: 'Usuário do banco de dados',
    default: 'root',
    critical: false
  },
  DB_NAME: {
    name: 'DB_NAME',
    description: 'Nome do banco de dados',
    default: 'gestao_organista',
    critical: false
  },
  PORT: {
    name: 'PORT',
    description: 'Porta do servidor',
    default: '5001',
    critical: false
  },
  SESSION_SECRET: {
    name: 'SESSION_SECRET',
    description: 'Chave secreta para sessões',
    default: null, // Será gerada se não fornecida
    critical: false
  }
};

/**
 * Valida e retorna variáveis de ambiente
 * @throws {Error} Se variável crítica não estiver configurada
 */
function validateEnv() {
  const errors = [];
  const warnings = [];
  const config = {};

  for (const [key, spec] of Object.entries(requiredEnvVars)) {
    const value = process.env[key];

    if (!value) {
      if (spec.critical) {
        errors.push(
          `❌ CRÍTICO: ${spec.name} não configurado!\n` +
          `   Descrição: ${spec.description}\n` +
          `   Configure no arquivo .env`
        );
      } else if (spec.default !== undefined) {
        config[key] = spec.default;
        warnings.push(
          `⚠️  ${spec.name} não configurado, usando padrão: ${spec.default}`
        );
      } else {
        config[key] = null;
      }
    } else {
      config[key] = value;
    }
  }

  // Gerar SESSION_SECRET se não fornecido
  if (!config.SESSION_SECRET) {
    // Em produção, isso deve ser configurado manualmente
    if (process.env.NODE_ENV === 'production') {
      warnings.push(
        '⚠️  SESSION_SECRET não configurado em produção. ' +
        'Configure manualmente no .env para maior segurança.'
      );
      // Gerar um secret temporário (não ideal para produção)
      config.SESSION_SECRET = require('crypto').randomBytes(32).toString('hex');
    } else {
      config.SESSION_SECRET = 'dev-session-secret-change-in-production';
    }
  }

  // Mostrar avisos
  if (warnings.length > 0) {
    console.warn('\n⚠️  AVISOS DE CONFIGURAÇÃO:');
    warnings.forEach(warning => console.warn(warning));
    console.warn('');
  }

  // Se houver erros críticos, lançar exceção
  if (errors.length > 0) {
    console.error('\n❌ ERROS CRÍTICOS DE CONFIGURAÇÃO:');
    errors.forEach(error => console.error(error));
    console.error('\n💡 Configure as variáveis no arquivo .env antes de iniciar o servidor.\n');
    throw new Error('Variáveis de ambiente críticas não configuradas');
  }

  return config;
}

/**
 * Retorna configuração validada
 */
function getConfig() {
  return validateEnv();
}

module.exports = {
  validateEnv,
  getConfig,
  requiredEnvVars
};
