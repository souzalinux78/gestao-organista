# 📚 Exemplo de Uso dos Middlewares - FASE 2

## 🎯 Como Usar os Novos Middlewares

---

## 1. ✅ VALIDAÇÃO

### Usando Schema Pré-definido:

```javascript
const { validate, schemas } = require('../middleware/validation');

// Login - usa schema pré-definido
router.post('/login', validate(schemas.login), async (req, res) => {
  // req.body.email e req.body.senha já estão validados e sanitizados
  const { email, senha } = req.body;
  // ...
});
```

### Criando Validação Customizada:

```javascript
const { validate, validators } = require('../middleware/validation');

router.post('/custom', validate({
  nome: [
    validators.required('Nome'),
    validators.minLength(3, 'Nome'),
    validators.maxLength(100, 'Nome')
  ],
  idade: [
    validators.required('Idade'),
    validators.integer('Idade')
  ],
  email: [
    validators.optional(), // Campo opcional
    validators.email,
    validators.maxLength(255, 'Email')
  ]
}), async (req, res) => {
  // req.body já validado e sanitizado
});
```

### Schemas Disponíveis:

- `schemas.register` - Validação de registro
- `schemas.login` - Validação de login
- `schemas.organista` - Validação de organista
- `schemas.igreja` - Validação de igreja
- `schemas.rodizio` - Validação de rodízio

---

## 2. ✅ TRATAMENTO DE ERRO

### Usando asyncHandler (Recomendado):

```javascript
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Antes (com try/catch):
router.post('/rota', async (req, res) => {
  try {
    // código
    if (erro) {
      return res.status(400).json({ error: 'Mensagem' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Depois (com asyncHandler):
router.post('/rota', asyncHandler(async (req, res) => {
  // código
  if (erro) {
    throw new AppError('Mensagem', 400, 'ERROR_CODE');
  }
  res.json({ success: true });
  // Erros são capturados automaticamente!
}));
```

### Tipos de Erro Tratados Automaticamente:

- ✅ Erros do MySQL (timeout, conexão, constraints)
- ✅ Erros de JWT (expirado, inválido)
- ✅ Erros de validação
- ✅ Erros genéricos (500)

### Criando Erros Customizados:

```javascript
const { AppError } = require('../middleware/errorHandler');

// Erro simples
throw new AppError('Mensagem de erro', 400);

// Erro com código
throw new AppError('Mensagem', 400, 'DUPLICATE_ENTRY');

// Erro com detalhes (apenas em desenvolvimento)
throw new AppError('Mensagem', 500, 'INTERNAL_ERROR', error.stack);
```

---

## 3. ✅ LOGGING

### Usando Logger:

```javascript
const logger = require('../utils/logger');

// Log de informação
logger.info('Usuário criado', { userId: user.id, email: user.email });

// Log de aviso
logger.warn('Tentativa de login falhou', { email, attempts: 3 });

// Log de erro
logger.error('Erro ao processar requisição', { 
  error: error.message, 
  userId: req.user?.id,
  path: req.path 
});

// Log de debug (apenas em desenvolvimento)
logger.debug('Valor intermediário', { value: someValue });
```

### Logging Automático de Requisições:

O logger já está configurado para logar automaticamente todas as requisições HTTP quando:
- `NODE_ENV !== 'production'` OU
- `LOG_LEVEL=debug` no .env

---

## 4. ✅ COMBINANDO TUDO

### Exemplo Completo:

```javascript
const express = require('express');
const router = express.Router();
const { validate, schemas } = require('../middleware/validation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../database/db');

// Rota com validação + errorHandler + logging
router.post('/organistas', 
  authenticate, // Middleware de autenticação existente
  validate(schemas.organista), // Validação
  asyncHandler(async (req, res) => { // Error handler
    const { nome, telefone, email } = req.body; // Já validado
    
    const pool = db.getDb();
    
    // Verificar duplicata
    const [existing] = await pool.execute(
      'SELECT id FROM organistas WHERE nome = ?',
      [nome]
    );
    
    if (existing.length > 0) {
      throw new AppError('Organista já existe', 400, 'DUPLICATE_ENTRY');
    }
    
    // Criar organista
    const [result] = await pool.execute(
      'INSERT INTO organistas (nome, telefone, email) VALUES (?, ?, ?)',
      [nome, telefone || null, email || null]
    );
    
    logger.info('Organista criada', { 
      organistaId: result.insertId, 
      nome,
      userId: req.user.id 
    });
    
    res.status(201).json({ 
      id: result.insertId, 
      nome, 
      telefone, 
      email 
    });
  })
);
```

---

## 📋 CHECKLIST DE MIGRAÇÃO

Para migrar uma rota existente:

- [ ] Importar middlewares necessários
- [ ] Adicionar `validate(schema)` antes do handler
- [ ] Envolver handler com `asyncHandler`
- [ ] Substituir `res.status(400).json()` por `throw new AppError()`
- [ ] Substituir `console.log` por `logger.info/debug/error`
- [ ] Remover try/catch manual (asyncHandler faz isso)
- [ ] Testar a rota

---

## ⚠️ IMPORTANTE

### Migração Gradual:
- ✅ Pode migrar uma rota por vez
- ✅ Código antigo continua funcionando
- ✅ Nenhuma quebra de compatibilidade

### Benefícios:
- ✅ Menos código
- ✅ Mais consistência
- ✅ Melhor manutenibilidade
- ✅ Logs estruturados

---

**Status:** ✅ Middlewares prontos para uso  
**Recomendação:** Migrar rotas gradualmente, testando cada uma
