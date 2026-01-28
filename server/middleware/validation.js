/**
 * Middleware de Validação Centralizado
 * Valida e sanitiza inputs de requisições
 */

/**
 * Valida se um campo está presente e não vazio
 */
function isRequired(value, fieldName) {
  if (value === undefined || value === null) {
    return `${fieldName} é obrigatório`;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return `${fieldName} não pode estar vazio`;
  }
  return null;
}

/**
 * Valida formato de email
 */
function isValidEmail(email) {
  if (!email) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Email inválido';
  }
  return null;
}

/**
 * Valida tamanho mínimo de string
 */
function minLength(value, min, fieldName) {
  if (!value) return null;
  if (typeof value === 'string' && value.length < min) {
    return `${fieldName} deve ter no mínimo ${min} caracteres`;
  }
  return null;
}

/**
 * Valida tamanho máximo de string
 */
function maxLength(value, max, fieldName) {
  if (!value) return null;
  if (typeof value === 'string' && value.length > max) {
    return `${fieldName} deve ter no máximo ${max} caracteres`;
  }
  return null;
}

/**
 * Valida se é número inteiro
 */
function isInteger(value, fieldName) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(Number(value))) {
    return `${fieldName} deve ser um número inteiro`;
  }
  return null;
}

/**
 * Valida se está em uma lista de valores permitidos
 */
function isIn(value, allowedValues, fieldName) {
  if (value === undefined || value === null) return null;
  if (!allowedValues.includes(value)) {
    return `${fieldName} deve ser um dos valores: ${allowedValues.join(', ')}`;
  }
  return null;
}

/**
 * Sanitiza string (remove espaços extras, trim)
 */
function sanitizeString(value) {
  if (typeof value === 'string') {
    return value.trim().replace(/\s+/g, ' ');
  }
  return value;
}

/**
 * Sanitiza email (lowercase, trim)
 */
function sanitizeEmail(value) {
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }
  return value;
}

/**
 * Middleware de validação genérico
 * @param {Object} rules - Regras de validação { field: [validators] }
 * @param {Object} options - Opções { sanitize: true, stopOnFirstError: false }
 */
function validate(rules, options = {}) {
  const { sanitize = true, stopOnFirstError = false } = options;

  return (req, res, next) => {
    const errors = [];
    const sanitized = {};

    // Validar cada campo
    for (const [field, validators] of Object.entries(rules)) {
      let value = req.body[field];

      // Sanitizar se habilitado
      if (sanitize) {
        if (typeof value === 'string') {
          // Sanitização específica por tipo
          if (field.toLowerCase().includes('email')) {
            value = sanitizeEmail(value);
          } else {
            value = sanitizeString(value);
          }
        }
        sanitized[field] = value;
      }

      // Aplicar validadores
      for (const validator of validators) {
        let error = null;

        if (typeof validator === 'function') {
          error = validator(value, field);
        } else if (Array.isArray(validator)) {
          const [validatorFn, ...args] = validator;
          error = validatorFn(value, ...args, field);
        }

        if (error) {
          errors.push({ field, message: error });
          if (stopOnFirstError) break;
        }
      }
    }

    // Se houver erros, retornar
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Erro de validação',
        errors: errors.map(e => e.message),
        fields: errors.map(e => e.field)
      });
    }

    // Aplicar valores sanitizados ao body
    if (sanitize) {
      Object.assign(req.body, sanitized);
    }

    next();
  };
}

/**
 * Validadores pré-definidos comuns
 */
const validators = {
  required: (fieldName) => (value) => isRequired(value, fieldName),
  email: (value) => isValidEmail(value),
  minLength: (min, fieldName) => (value) => minLength(value, min, fieldName),
  maxLength: (max, fieldName) => (value) => maxLength(value, max, fieldName),
  integer: (fieldName) => (value) => isInteger(value, fieldName),
  in: (allowedValues, fieldName) => (value) => isIn(value, allowedValues, fieldName),
  optional: () => () => null // Sempre passa se opcional
};

/**
 * Schemas de validação pré-definidos
 */
const schemas = {
  // Validação de registro
  register: {
    nome: [
      validators.required('Nome'),
      validators.minLength(2, 'Nome'),
      validators.maxLength(255, 'Nome')
    ],
    email: [
      validators.required('Email'),
      validators.email,
      validators.maxLength(255, 'Email')
    ],
    senha: [
      validators.required('Senha'),
      validators.minLength(6, 'Senha'),
      validators.maxLength(100, 'Senha')
    ],
    igreja: [
      validators.required('Igreja/Comum'),
      validators.minLength(2, 'Igreja/Comum'),
      validators.maxLength(255, 'Igreja/Comum')
    ],
    tipo_usuario: [
      validators.optional(),
      validators.in(['encarregado', 'examinadora', 'instrutoras'], 'Tipo de usuário')
    ]
  },

  // Validação de login
  login: {
    email: [
      validators.required('Email'),
      validators.email
    ],
    senha: [
      validators.required('Senha')
    ]
  },

  // Validação de organista
  organista: {
    nome: [
      validators.required('Nome'),
      validators.minLength(2, 'Nome'),
      validators.maxLength(255, 'Nome')
    ],
    telefone: [
      validators.optional(),
      validators.maxLength(20, 'Telefone')
    ],
    email: [
      validators.optional(),
      validators.email,
      validators.maxLength(255, 'Email')
    ],
    oficializada: [
      validators.optional()
    ],
    ativa: [
      validators.optional()
    ],
    ordem: [
      validators.optional(),
      validators.integer('Ordem')
    ]
  },

  // Validação de igreja
  igreja: {
    nome: [
      validators.required('Nome'),
      validators.minLength(2, 'Nome'),
      validators.maxLength(255, 'Nome')
    ],
    endereco: [
      validators.optional(),
      validators.maxLength(500, 'Endereço')
    ],
    encarregado_local_nome: [
      validators.optional(),
      validators.maxLength(255, 'Nome do encarregado local')
    ],
    encarregado_local_telefone: [
      validators.optional(),
      validators.maxLength(20, 'Telefone do encarregado local')
    ],
    encarregado_regional_nome: [
      validators.optional(),
      validators.maxLength(255, 'Nome do encarregado regional')
    ],
    encarregado_regional_telefone: [
      validators.optional(),
      validators.maxLength(20, 'Telefone do encarregado regional')
    ]
  },

  // Validação de rodízio
  rodizio: {
    igreja_id: [
      validators.required('Igreja'),
      validators.integer('Igreja')
    ],
    periodo_meses: [
      validators.required('Período em meses'),
      validators.integer('Período em meses'),
      validators.in([3, 6, 12], 'Período em meses')
    ],
    ciclo_inicial: [
      validators.optional(),
      validators.integer('Ciclo inicial')
    ],
    data_inicial: [
      validators.optional()
    ],
    organista_inicial: [
      validators.optional(),
      validators.integer('Organista inicial')
    ]
  }
};

module.exports = {
  validate,
  validators,
  schemas,
  // Exportar funções úteis
  isRequired,
  isValidEmail,
  minLength,
  maxLength,
  isInteger,
  isIn,
  sanitizeString,
  sanitizeEmail
};
