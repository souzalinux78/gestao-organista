# 🔧 Como Adicionar a Coluna 'funcao' no Banco de Dados

## ⚠️ Erro Encontrado

Se você está vendo o erro: **"Unknown column 'funcao' in 'field list'"**

Isso significa que a coluna `funcao` ainda não foi adicionada na tabela `rodizios` do banco de dados.

## ✅ Solução Rápida

### Opção 1: Executar Script SQL (Recomendado)

1. Abra o **MySQL Workbench** ou qualquer cliente MySQL
2. Conecte-se ao banco `gestao_organista`
3. Execute o seguinte comando SQL:

```sql
USE gestao_organista;

ALTER TABLE rodizios 
ADD COLUMN funcao ENUM('meia_hora', 'tocar_culto') NOT NULL DEFAULT 'tocar_culto' 
AFTER dia_semana;

UPDATE rodizios 
SET funcao = 'tocar_culto' 
WHERE funcao IS NULL OR funcao = '';

ALTER TABLE rodizios 
ADD UNIQUE KEY unique_rodizio_culto_funcao (culto_id, data_culto, funcao);
```

### Opção 2: Via Linha de Comando MySQL

```bash
mysql -u root -p gestao_organista < MIGRAR_FUNCAO.sql
```

Ou execute diretamente:

```bash
mysql -u root -p
```

Depois:

```sql
USE gestao_organista;
ALTER TABLE rodizios ADD COLUMN funcao ENUM('meia_hora', 'tocar_culto') NOT NULL DEFAULT 'tocar_culto' AFTER dia_semana;
UPDATE rodizios SET funcao = 'tocar_culto' WHERE funcao IS NULL OR funcao = '';
ALTER TABLE rodizios ADD UNIQUE KEY unique_rodizio_culto_funcao (culto_id, data_culto, funcao);
```

### Opção 3: Executar Script Node.js

Se o script de migração não funcionou, tente executar manualmente:

1. Abra o terminal na pasta do projeto
2. Execute:

```bash
node server/scripts/migrate-rodizios-funcao.js
```

## ✅ Verificar se Funcionou

Após executar a migração, verifique se a coluna foi criada:

```sql
DESCRIBE rodizios;
```

Você deve ver a coluna `funcao` na lista.

## 🎯 Depois da Migração

Após adicionar a coluna, você pode:
1. Gerar novos rodízios (que terão a função correta)
2. Os rodízios antigos terão função padrão "tocar_culto"
3. Pode limpar e refazer os rodízios se necessário

## ⚠️ Nota

Se você já tinha rodízios cadastrados, eles serão atualizados automaticamente com a função "tocar_culto". Se quiser refazer a distribuição com as novas funções (meia hora e tocar no culto), use o botão **"Limpar e Refazer"** na página de Rodízios.
