# 🚀 Instruções de Execução da Migração

## ❌ Erro Encontrado

O MySQL não suporta `ADD COLUMN IF NOT EXISTS` diretamente.

## ✅ Soluções Disponíveis

### **OPÇÃO 1: Script JavaScript (RECOMENDADO)** ⭐

O script JavaScript já faz todas as verificações corretamente.

```bash
cd /var/www/gestao-organista
node server/scripts/migrate-tenants.js
```

**Vantagens:**
- ✅ Faz todas as verificações automaticamente
- ✅ Trata erros graciosamente
- ✅ Mostra estatísticas detalhadas
- ✅ Mais seguro

---

### **OPÇÃO 2: SQL Simplificado (Mais Rápido)**

Se preferir SQL direto, use a versão simplificada:

```bash
cd /var/www/gestao-organista

# Primeiro, criar tabela tenants (se ainda não criou)
mysql -u root -p gestao_organista < server/scripts/migrate-001-create-tenants.sql

# Depois, adicionar tenant_id (versão simplificada)
mysql -u root -p gestao_organista < server/scripts/migrate-002-add-tenant-to-users-simple.sql
```

**Nota:** Se der erro de "coluna já existe", ignore e continue. Significa que já está criada.

---

### **OPÇÃO 3: SQL Manual (Passo a Passo)**

Execute cada comando manualmente no MySQL:

```bash
mysql -u root -p gestao_organista
```

Depois execute:

```sql
-- 1. Criar tenant padrão (se não existir)
INSERT INTO tenants (`nome`, `slug`, `ativo`)
VALUES ('Tenant Padrão', 'default', 1)
ON DUPLICATE KEY UPDATE `nome` = `nome`;

-- 2. Verificar se coluna já existe
SELECT COUNT(*) 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'usuarios' 
  AND COLUMN_NAME = 'tenant_id';

-- 3. Se retornar 0, adicionar coluna:
ALTER TABLE `usuarios`
ADD COLUMN `tenant_id` INT NULL AFTER `id`;

-- 4. Adicionar índice
ALTER TABLE `usuarios`
ADD INDEX `idx_usuarios_tenant` (`tenant_id`);

-- 5. Adicionar foreign key
ALTER TABLE `usuarios`
ADD CONSTRAINT `fk_usuarios_tenant` 
FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;

-- 6. Migrar usuários existentes
UPDATE `usuarios`
SET `tenant_id` = (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1)
WHERE `tenant_id` IS NULL;

-- 7. Verificar
SELECT 
  COUNT(*) AS total,
  COUNT(tenant_id) AS com_tenant,
  COUNT(*) - COUNT(tenant_id) AS sem_tenant
FROM usuarios;
```

---

## ✅ Verificação

Após executar, verifique:

```sql
-- Ver tabela tenants
SELECT * FROM tenants;

-- Ver usuários com tenant_id
SELECT id, nome, email, tenant_id FROM usuarios LIMIT 10;

-- Estatísticas
SELECT 
  COUNT(*) AS total,
  COUNT(tenant_id) AS com_tenant
FROM usuarios;
```

---

## 🎯 Recomendação Final

**Use a OPÇÃO 1 (Script JavaScript)** - é a mais segura e já está integrada ao sistema.

Se preferir SQL direto, use a **OPÇÃO 2 (SQL Simplificado)**.

---

## ⚠️ Importante

- ✅ Se der erro de "coluna já existe" → **ignore**, está tudo certo
- ✅ Se der erro de "índice já existe" → **ignore**, está tudo certo  
- ✅ Se der erro de "foreign key já existe" → **ignore**, está tudo certo

A migração é **idempotente** - pode executar múltiplas vezes sem problemas.
