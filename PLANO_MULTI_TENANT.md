# 🏢 Plano de Transformação Multi-Tenant

## 📋 Visão Geral

Transformação progressiva do sistema em SaaS multi-tenant, garantindo:
- ✅ **Zero downtime** para usuários existentes
- ✅ **Compatibilidade retroativa** durante migração
- ✅ **Isolamento completo** de dados entre tenants
- ✅ **Evolução incremental** sem quebrar funcionalidades

---

## 🎯 Estrutura Multi-Tenant

### Conceito de Tenant
- **Tenant** = Empresa/Escola/Organização que usa o sistema
- Cada tenant tem seus próprios dados isolados
- Usuários pertencem a um tenant
- Todos os dados (igrejas, organistas, rodízios) pertencem a um tenant

### Modelo de Dados

```
tenants (nova tabela)
  ├── id
  ├── nome
  ├── slug (único, para URLs)
  ├── ativo
  └── created_at

usuarios (modificado)
  ├── tenant_id (nova coluna, nullable inicialmente)
  └── ... (campos existentes)

igrejas (modificado)
  ├── tenant_id (nova coluna, nullable inicialmente)
  └── ... (campos existentes)

organistas (modificado)
  ├── tenant_id (nova coluna, nullable inicialmente)
  └── ... (campos existentes)

cultos (modificado)
  └── ... (herda tenant_id de igrejas via JOIN)

rodizios (modificado)
  └── ... (herda tenant_id de igrejas via JOIN)
```

---

## 📦 Fases de Implementação

### **FASE 1: Fundação (Sem Breaking Changes)** ✅
**Objetivo:** Criar infraestrutura básica sem quebrar nada

1. ✅ Criar tabela `tenants`
2. ✅ Adicionar `tenant_id` em `usuarios` (nullable)
3. ✅ Criar tenant padrão para dados existentes
4. ✅ Migrar usuários existentes para tenant padrão

**Impacto:** Zero - colunas nullable, dados existentes continuam funcionando

**Arquivos:**
- `migrate-001-create-tenants.sql`
- `migrate-002-add-tenant-to-users.sql`

---

### **FASE 2: Isolamento de Dados (Backward Compatible)** 🔄
**Objetivo:** Adicionar tenant_id nas tabelas de dados

1. Adicionar `tenant_id` em `igrejas` (nullable)
2. Adicionar `tenant_id` em `organistas` (nullable)
3. Migrar dados existentes para tenant padrão
4. Criar índices compostos (tenant_id + id)

**Impacto:** Zero - queries continuam funcionando sem tenant_id

**Arquivos:**
- `migrate-003-add-tenant-to-igrejas.sql`
- `migrate-004-add-tenant-to-organistas.sql`

---

### **FASE 3: Middleware e Resolução** 🔄
**Objetivo:** Criar middleware para extrair tenant do JWT

1. Criar middleware `tenantResolver`
2. Extrair tenant_id do JWT (adicionar ao token no login)
3. Adicionar tenant_id ao `req.user`
4. Criar helper `getTenantId(req)`

**Impacto:** Zero - middleware opcional, não quebra rotas existentes

**Arquivos:**
- `server/middleware/tenantResolver.js`

---

### **FASE 4: Ajuste Gradual de Queries** 🔄
**Objetivo:** Atualizar queries para incluir filtro tenant_id

1. Atualizar queries uma rota por vez
2. Adicionar filtro `WHERE tenant_id = ?` progressivamente
3. Manter compatibilidade com tenant_id NULL (dados legados)

**Impacto:** Mínimo - cada rota testada individualmente

**Arquivos:**
- Atualizar `server/routes/*.js` progressivamente
- Atualizar `server/services/*.js` progressivamente

---

### **FASE 5: Finalização** 🔄
**Objetivo:** Tornar tenant_id obrigatório

1. Tornar tenant_id NOT NULL (após migração completa)
2. Remover compatibilidade com tenant_id NULL
3. Adicionar validações finais

**Impacto:** Zero - apenas após 100% de migração

**Arquivos:**
- `migrate-005-make-tenant-required.sql`

---

## 🔒 Estratégia de Isolamento

### Regra de Ouro
**TODAS as queries devem incluir `tenant_id` após FASE 4**

### Exceções
- Admin global (pode ver todos os tenants) - opcional
- Rotas públicas (login, registro) - sem tenant

### Padrão de Query
```sql
-- ANTES (sem tenant)
SELECT * FROM igrejas WHERE id = ?

-- DEPOIS (com tenant)
SELECT * FROM igrejas 
WHERE id = ? AND tenant_id = ?
```

---

## 🛡️ Garantias de Segurança

1. **Isolamento por Design**
   - Queries sem tenant_id = erro (após FASE 5)
   - Middleware obrigatório em rotas protegidas

2. **Validação de Acesso**
   - Usuário só acessa dados do seu tenant
   - Admin pode ter acesso multi-tenant (opcional)

3. **Migração Segura**
   - Dados existentes → tenant padrão
   - Rollback possível a qualquer momento
   - Testes incrementais

---

## 📝 Próximos Passos

**Vou começar pela FASE 1 que é 100% segura e não quebra nada.**

**Aguardando sua aprovação para iniciar FASE 1.**
