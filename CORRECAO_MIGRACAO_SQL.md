# 🔧 Correção: Erro de Sintaxe SQL

## ❌ Problema

O MySQL não suporta `ADD COLUMN IF NOT EXISTS` diretamente no `ALTER TABLE`.

**Erro:**
```
ERROR 1064 (42000): You have an error in your SQL syntax; 
check the manual that corresponds to your MySQL server version 
to use near 'IF NOT EXISTS `tenant_id`'
```

## ✅ Solução

Criei duas versões do script:

### Opção 1: Script Simplificado (Recomendado)
**Arquivo:** `server/scripts/migrate-002-add-tenant-to-users-simple.sql`

Este script tenta adicionar a coluna diretamente. Se já existir, você verá um erro, mas pode ignorá-lo e continuar.

**Como usar:**
```bash
mysql -u root -p gestao_organista < server/scripts/migrate-002-add-tenant-to-users-simple.sql
```

**Se der erro de coluna já existe:**
- Ignore o erro e continue
- A coluna já está criada, então está tudo certo

### Opção 2: Script com Verificação (Mais Seguro)
**Arquivo:** `server/scripts/migrate-002-add-tenant-to-users.sql`

Este script verifica se a coluna existe antes de adicionar usando prepared statements.

**Como usar:**
```bash
mysql -u root -p gestao_organista < server/scripts/migrate-002-add-tenant-to-users.sql
```

### Opção 3: Usar Script JavaScript (Mais Seguro)
**Arquivo:** `server/scripts/migrate-tenants.js`

Este script já faz todas as verificações corretamente.

**Como usar:**
```bash
node server/scripts/migrate-tenants.js
```

---

## 🎯 Recomendação

**Use o script JavaScript** (`migrate-tenants.js`) que já faz todas as verificações corretamente e é mais seguro.

Ou use o **script SQL simplificado** se preferir SQL direto.

---

## ✅ Próximos Passos

1. Execute a migração usando uma das opções acima
2. Verifique se funcionou:
   ```sql
   SELECT * FROM tenants;
   SELECT id, nome, email, tenant_id FROM usuarios LIMIT 5;
   ```

3. Se tudo estiver OK, a FASE 1 está completa!
