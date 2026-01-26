# 🔧 Correção do Erro 429 (Too Many Requests) no Login

## 📋 Problema Identificado

O erro **429 (Too Many Requests)** estava ocorrendo ao tentar fazer login porque:

1. **Rate limiting muito restritivo**: O rate limit estava aplicado a **TODAS** as rotas `/api` com limite de apenas **300 requisições por 15 minutos**
2. **Sem diferenciação**: A rota de login (`/api/auth/login`) estava sujeita ao mesmo limite que todas as outras rotas
3. **Limite facilmente atingível**: Em ambientes com múltiplos usuários ou requisições frequentes, o limite era facilmente ultrapassado

## ✅ Solução Implementada

### 1. Rate Limit Específico para Login
- **Limite**: 20 tentativas de login por 15 minutos
- **Proteção**: Previne ataques de brute force
- **Permissivo**: Permite tentativas legítimas de login
- **Configuração**: `skipSuccessfulRequests: true` - não conta logins bem-sucedidos

### 2. Rate Limit Geral Aumentado
- **Limite anterior**: 300 requisições por 15 minutos
- **Limite novo**: 500 requisições por 15 minutos
- **Aplicação**: Apenas nas rotas protegidas (não nas rotas públicas de autenticação)

### 3. Separação de Rate Limits
- **Rotas públicas** (`/api/auth/*`): Apenas login tem rate limit específico
- **Rotas protegidas** (`/api/organistas`, `/api/igrejas`, etc.): Rate limit geral de 500 requisições

## 📝 Mudanças no Código

### Arquivo: `server/index.js`

**Antes:**
```javascript
if (rateLimit) {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api', apiLimiter); // Aplicado a TODAS as rotas /api
}
```

**Depois:**
```javascript
if (rateLimit) {
  // Rate limit específico para login
  loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
    skipSuccessfulRequests: true
  });
  
  // Rate limit geral aumentado
  apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Aumentado de 300 para 500
    standardHeaders: true,
    legacyHeaders: false
  });
  
  // Aplicar rate limit apenas na rota de login
  app.use('/api/auth', (req, res, next) => {
    if (req.path === '/login' && req.method === 'POST') {
      return loginLimiter(req, res, next);
    }
    next();
  });
  
  // Aplicar rate limit geral apenas nas rotas protegidas
  app.use('/api/organistas', apiLimiter, organistasRoutes);
  app.use('/api/igrejas', apiLimiter, igrejasRoutes);
  // ... outras rotas protegidas
}
```

## 🎯 Benefícios

1. **Login mais confiável**: Usuários legítimos não serão bloqueados por rate limit
2. **Segurança mantida**: Ainda previne ataques de brute force (20 tentativas por 15 minutos)
3. **Melhor performance**: Limite geral aumentado permite mais operações normais
4. **Separação clara**: Rotas públicas e protegidas têm limites diferentes

## 🔍 Como Testar

1. **Teste de login normal**: Deve funcionar sem erros 429
2. **Teste de brute force**: Após 20 tentativas falhas, deve retornar 429
3. **Teste de requisições gerais**: Deve suportar até 500 requisições por 15 minutos nas rotas protegidas

## ⚠️ Notas Importantes

- O rate limit de login **não conta** requisições bem-sucedidas (`skipSuccessfulRequests: true`)
- O rate limit geral é aplicado **apenas** nas rotas protegidas
- Rotas públicas de autenticação (register, etc.) **não têm** rate limit geral aplicado
