# Como Criar o Banco de Dados

## 📋 Opções para Criar o Banco

### Opção 1: Executar Script SQL (Recomendado)

```bash
# No servidor, execute:
mysql -u root -p < database.sql

# Ou se usar usuário específico:
mysql -u gestao_user -p gestao_organista < database.sql
```

### Opção 2: Executar Manualmente no MySQL

```bash
# Acessar MySQL
mysql -u root -p

# No prompt do MySQL, execute:
source /var/www/gestao-organista/database.sql

# Ou copie e cole o conteúdo do arquivo database.sql
```

### Opção 3: O Sistema Cria Automaticamente

O sistema criará o banco automaticamente na primeira execução se:
- O arquivo `.env` estiver configurado corretamente
- O usuário MySQL tiver permissão `CREATE DATABASE`

---

## 🔧 Configuração do Usuário MySQL

### Criar Usuário e Conceder Permissões

```bash
# Acessar MySQL como root
mysql -u root -p

# No prompt do MySQL:
```

```sql
-- Criar banco de dados
CREATE DATABASE IF NOT EXISTS `gestao_organista` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Criar usuário (substitua 'senha_forte' por uma senha segura)
CREATE USER IF NOT EXISTS 'gestao_user'@'localhost' IDENTIFIED BY 'senha_forte';

-- Conceder todas as permissões
GRANT ALL PRIVILEGES ON gestao_organista.* TO 'gestao_user'@'localhost';

-- Aplicar mudanças
FLUSH PRIVILEGES;

-- Verificar
SHOW DATABASES;
SELECT user, host FROM mysql.user WHERE user = 'gestao_user';

-- Sair
EXIT;
```

---

## ✅ Verificar se o Banco Foi Criado

```bash
# Listar bancos de dados
mysql -u root -p -e "SHOW DATABASES;"

# Verificar se o banco existe
mysql -u root -p -e "SHOW DATABASES LIKE 'gestao_organista';"

# Listar tabelas do banco
mysql -u root -p -e "USE gestao_organista; SHOW TABLES;"
```

---

## 📝 Estrutura do Banco

O banco `gestao_organista` contém as seguintes tabelas:

1. **organistas** - Cadastro de organistas
2. **igrejas** - Cadastro de igrejas
3. **cultos** - Cadastro de cultos
4. **organistas_igreja** - Relação entre organistas e igrejas
5. **rodizios** - Rodízios gerados
6. **notificacoes** - Histórico de notificações
7. **usuarios** - Usuários do sistema
8. **usuario_igreja** - Associação entre usuários e igrejas

---

## 🔄 Recriar o Banco (Se Necessário)

```bash
# ⚠️ ATENÇÃO: Isso apagará todos os dados!

# Acessar MySQL
mysql -u root -p

# No prompt do MySQL:
```

```sql
-- Deletar banco (CUIDADO!)
DROP DATABASE IF EXISTS gestao_organista;

-- Recriar banco
CREATE DATABASE gestao_organista 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Sair
EXIT;
```

```bash
# Executar script de criação
mysql -u root -p gestao_organista < database.sql
```

---

## 🛠️ Solução de Problemas

### Erro: "Access denied"

```bash
# Verificar se o usuário tem permissões
mysql -u root -p -e "SHOW GRANTS FOR 'gestao_user'@'localhost';"
```

### Erro: "Database already exists"

O banco já existe. Você pode:
- Usar o banco existente
- Ou deletar e recriar (CUIDADO: apaga dados!)

### Erro: "Table already exists"

As tabelas já existem. O script usa `CREATE TABLE IF NOT EXISTS`, então não há problema.

### Verificar Estrutura das Tabelas

```bash
mysql -u root -p gestao_organista -e "DESCRIBE organistas;"
mysql -u root -p gestao_organista -e "DESCRIBE igrejas;"
mysql -u root -p gestao_organista -e "DESCRIBE rodizios;"
```

---

## 📊 Verificar Dados

```bash
# Contar registros em cada tabela
mysql -u root -p gestao_organista << EOF
SELECT 'organistas' as tabela, COUNT(*) as total FROM organistas
UNION ALL
SELECT 'igrejas', COUNT(*) FROM igrejas
UNION ALL
SELECT 'cultos', COUNT(*) FROM cultos
UNION ALL
SELECT 'rodizios', COUNT(*) FROM rodizios
UNION ALL
SELECT 'usuarios', COUNT(*) FROM usuarios;
EOF
```

---

## ✅ Checklist

- [ ] MySQL instalado e rodando
- [ ] Usuário MySQL criado (ou usando root)
- [ ] Arquivo `.env` configurado
- [ ] Banco de dados criado
- [ ] Tabelas criadas
- [ ] Permissões concedidas
- [ ] Sistema consegue conectar ao banco

---

**✅ Banco de dados pronto para uso!**
