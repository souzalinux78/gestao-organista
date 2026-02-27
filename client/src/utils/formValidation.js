/**
 * Utilitário para validação de formulários no frontend
 * Validações básicas antes de enviar para o backend
 */

/**
 * Valida email
 */
export function validateEmail(email) {
  if (!email) return { valid: true }; // Email opcional
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      message: 'Email inválido'
    };
  }
  
  return { valid: true };
}

/**
 * Valida telefone (formato brasileiro básico)
 */
export function validatePhone(phone) {
  if (!phone) return { valid: true }; // Telefone opcional
  
  // Remove caracteres não numéricos
  const digits = phone.replace(/\D/g, '');
  
  // Deve ter entre 10 e 11 dígitos (com DDD)
  if (digits.length < 10 || digits.length > 11) {
    return {
      valid: false,
      message: 'Telefone deve ter 10 ou 11 dígitos'
    };
  }
  
  return { valid: true };
}

/**
 * Valida campo obrigatório
 */
export function validateRequired(value, fieldName = 'Campo') {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return {
      valid: false,
      message: `${fieldName} é obrigatório`
    };
  }
  
  return { valid: true };
}

/**
 * Valida tamanho mínimo
 */
export function validateMinLength(value, minLength, fieldName = 'Campo') {
  if (!value) return { valid: true }; // Campo opcional
  
  if (value.length < minLength) {
    return {
      valid: false,
      message: `${fieldName} deve ter no mínimo ${minLength} caracteres`
    };
  }
  
  return { valid: true };
}

/**
 * Valida tamanho máximo
 */
export function validateMaxLength(value, maxLength, fieldName = 'Campo') {
  if (!value) return { valid: true }; // Campo opcional
  
  if (value.length > maxLength) {
    return {
      valid: false,
      message: `${fieldName} deve ter no máximo ${maxLength} caracteres`
    };
  }
  
  return { valid: true };
}

/**
 * Valida número inteiro
 */
export function validateInteger(value, fieldName = 'Campo') {
  if (!value && value !== 0) return { valid: true }; // Campo opcional
  
  const num = Number(value);
  if (isNaN(num) || !Number.isInteger(num)) {
    return {
      valid: false,
      message: `${fieldName} deve ser um número inteiro`
    };
  }
  
  return { valid: true };
}

/**
 * Valida número positivo
 */
export function validatePositive(value, fieldName = 'Campo') {
  if (!value && value !== 0) return { valid: true }; // Campo opcional
  
  const num = Number(value);
  if (isNaN(num) || num < 0) {
    return {
      valid: false,
      message: `${fieldName} deve ser um número positivo`
    };
  }
  
  return { valid: true };
}

/**
 * Valida múltiplas regras
 */
export function validateField(value, rules = []) {
  for (const rule of rules) {
    const result = rule(value);
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}

/**
 * Valida formulário completo
 */
export function validateForm(formData, schema) {
  const errors = {};
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = formData[field];
    const result = validateField(value, rules);
    
    if (!result.valid) {
      errors[field] = result.message;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

const formValidationUtils = {
  validateEmail,
  validatePhone,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validateInteger,
  validatePositive,
  validateField,
  validateForm
};

export default formValidationUtils;
