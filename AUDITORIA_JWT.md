# 🔒 Auditoria de Segurança JWT - Sistema de Gestão de Organistas

## 📅 Data: 2025-01-26

---

## 🔍 ANÁLISE ATUAL

### 1. **Armazenamento do Token**

**Situação Atual:**
- ✅ Token armazenado em `localStorage`
- ✅ Token enviado via header `Authorization: Bearer <token>`
- ✅ Token carregado na inicialização do app

**Localização:**
- `client/src/contexts/AuthContext.js` - Armazena em `localStorage.setItem('token', token)`
- `client/src/services/api.js` - Lê de `localStorage.getItem('token')`
- `client/src/App.js` - Verifica existência em `PrivateRoute`

---

### 2. **Expiração do Token**

**Situação Atual:**
- ✅ Token expira em **7 dias** (`expiresIn: '7d'`)
- ✅ Backend valida expiração via `jwt.verify()`
- ❌ **Frontend NÃO verifica expiração antes de usar**
- ❌ **PrivateRoute só verifica existência, não validade**

**Código Atual:**
```javascript
// server/routes/auth.js
const token = jwt.sign(
  { userId: user.id, email: user.email, role: user.role, tipo_usuario: user.tipo_usuario },
  envConfig.JWT_SECRET,
  { expiresIn: '7d' } // ⚠️ 7 dias é muito longo
);
```

---

### 3. **Refresh Token**

**Situação Atual:**
- ❌ **NÃO existe refresh token**
- ❌ Usuário precisa fazer login novamente após expiração
- ❌ Token de 7 dias não pode ser revogado

---

### 4. **Middleware de Proteção de Rotas**

**Situação Atual:**
- ✅ Backend: `authenticate` middleware valida token
- ⚠️ Frontend: `PrivateRoute` só verifica **existência**, não **validade**
- ❌ Token expirado pode passar pela `PrivateRoute` e falhar na API

**Código Atual:**
```javascript
// client/src/App.js
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
  // ⚠️ Não verifica se token está expirado!
}
```

---

### 5. **Token Replay / Revogação**

**Situação Atual:**
- ❌ **NÃO existe blacklist de tokens**
- ❌ Token pode ser usado mesmo após logout
- ❌ Token roubado pode ser usado por 7 dias
- ❌ Não há como revogar token antes da expiração

**Cenário de Risco:**
1. Usuário faz login → recebe token válido por 7 dias
2. Usuário faz logout → token removido do localStorage
3. **MAS:** Se token foi copiado antes do logout, ainda é válido por 7 dias
4. Atacante pode usar token roubado até expirar

---

## ⚠️ RISCOS IDENTIFICADOS

### 🔴 **CRÍTICOS**

1. **Token em localStorage (XSS)**
   - **Risco:** Scripts maliciosos podem ler `localStorage`
   - **Impacto:** Roubo de token e acesso não autorizado
   - **Probabilidade:** Média (depende de vulnerabilidades XSS)

2. **Token Replay**
   - **Risco:** Token roubado pode ser usado por 7 dias
   - **Impacto:** Acesso não autorizado prolongado
   - **Probabilidade:** Alta (se token for comprometido)

3. **Sem Verificação de Expiração no Frontend**
   - **Risco:** Token expirado pode ser usado até falhar na API
   - **Impacto:** UX ruim, requisições desnecessárias
   - **Probabilidade:** Alta (acontece após 7 dias)

### 🟡 **MÉDIOS**

4. **Tempo de Expiração Longo (7 dias)**
   - **Risco:** Janela de ataque muito grande
   - **Impacto:** Token comprometido válido por muito tempo
   - **Probabilidade:** Média

5. **Sem Refresh Token**
   - **Risco:** Usuário precisa fazer login novamente
   - **Impacto:** UX ruim, mas não é vulnerabilidade
   - **Probabilidade:** N/A (questão de UX)

### 🟢 **BAIXOS**

6. **Sem Rate Limiting Específico**
   - **Risco:** Ataques de força bruta (já existe rate limit geral)
   - **Impacto:** Baixo (já protegido)
   - **Probabilidade:** Baixa

---

## ✅ SOLUÇÕES PROPOSTAS (INCREMENTAIS)

### **FASE 1: Verificação de Expiração no Frontend** ⚡ (Prioritário)

**Objetivo:** Verificar expiração do token antes de usar

**Mudanças:**
1. Criar utilitário para decodificar e verificar JWT no frontend
2. Atualizar `PrivateRoute` para verificar expiração
3. Atualizar interceptor da API para verificar antes de enviar
4. Limpar token expirado automaticamente

**Benefícios:**
- ✅ Evita requisições desnecessárias
- ✅ Melhor UX (redireciona antes de falhar)
- ✅ Não quebra funcionalidade atual

---

### **FASE 2: Reduzir Tempo de Expiração** ⚡ (Recomendado)

**Objetivo:** Reduzir janela de ataque

**Mudanças:**
1. Reduzir `expiresIn` de `'7d'` para `'1d'` (1 dia)
2. Opcional: Adicionar refresh token (mais complexo)

**Benefícios:**
- ✅ Reduz risco de token replay
- ✅ Token comprometido válido por menos tempo
- ✅ Compatível com sistema atual

---

### **FASE 3: Blacklist de Tokens (Opcional)** 🔒 (Avançado)

**Objetivo:** Permitir revogação de tokens

**Mudanças:**
1. Criar tabela `token_blacklist` no banco
2. Adicionar token à blacklist no logout
3. Verificar blacklist no middleware `authenticate`
4. Limpar blacklist periodicamente (tokens expirados)

**Benefícios:**
- ✅ Permite revogação de tokens
- ✅ Protege contra token replay após logout
- ✅ Mais seguro para produção

**Complexidade:** Média (requer mudanças no banco)

---

### **FASE 4: Migrar para sessionStorage (Opcional)** 🔒 (Avançado)

**Objetivo:** Reduzir risco de XSS (mas não elimina)

**Mudanças:**
1. Trocar `localStorage` por `sessionStorage`
2. Token expira ao fechar aba/navegador

**Benefícios:**
- ✅ Reduz risco de XSS (token não persiste)
- ✅ Mais seguro para sessões temporárias

**Desvantagens:**
- ❌ Token perdido ao fechar aba (pode ser ruim para PWA)
- ❌ Não elimina completamente risco de XSS

**Nota:** Para PWA, `localStorage` pode ser preferível

---

## 📋 PLANO DE IMPLEMENTAÇÃO

### **PASSO 1: Utilitário JWT no Frontend**

Criar `client/src/utils/jwt.js`:
- Função para decodificar JWT (sem verificar assinatura)
- Função para verificar expiração
- Função para verificar se token é válido

### **PASSO 2: Atualizar PrivateRoute**

Modificar `client/src/App.js`:
- Verificar expiração antes de permitir acesso
- Redirecionar para login se expirado

### **PASSO 3: Atualizar Interceptor da API**

Modificar `client/src/services/api.js`:
- Verificar expiração antes de enviar requisição
- Limpar token expirado automaticamente

### **PASSO 4: Reduzir Tempo de Expiração**

Modificar `server/routes/auth.js`:
- Mudar `expiresIn: '7d'` para `expiresIn: '1d'`

### **PASSO 5: Blacklist (Opcional)**

Criar:
- `server/database/migrations/addTokenBlacklist.js`
- Atualizar `server/middleware/auth.js`
- Atualizar `client/src/contexts/AuthContext.js` (logout)

---

## 🎯 RECOMENDAÇÕES PRIORITÁRIAS

### **Para Produção Imediata:**

1. ✅ **Implementar FASE 1** (Verificação de expiração)
2. ✅ **Implementar FASE 2** (Reduzir expiração para 1 dia)
3. ⚠️ **Considerar FASE 3** (Blacklist) se necessário revogação

### **Não Recomendado Agora:**

- ❌ Migrar para sessionStorage (quebra PWA)
- ❌ Implementar refresh token completo (complexidade alta)

---

## 🔐 COMPATIBILIDADE

**Todas as soluções propostas:**
- ✅ **Não quebram** funcionalidade atual
- ✅ **São incrementais** (podem ser aplicadas uma por vez)
- ✅ **Mantêm** compatibilidade com código existente
- ✅ **Melhoram** segurança sem refatoração completa

---

**Status:** ✅ Análise Completa  
**Próximo Passo:** Implementar FASE 1 e FASE 2
