# Cultos (v2.0) – Alterações no banco para produção

## Análise da tela

A tela **Cultos (v2.0)** usa os campos: Igreja, Dia da Semana, Hora, Tipo (Culto Oficial), **Recorrência** (Toda semana / Mensal) e Ativo.

Para isso, a tabela `cultos` precisa das colunas de **recorrência**:

| Coluna             | Tipo                         | Uso                                      |
|--------------------|------------------------------|------------------------------------------|
| `tipo_recorrencia` | ENUM('semanal','mensal')      | "Toda semana" = semanal, "Mensal" = mensal |
| `ordem_mes`        | TINYINT NULL                 | Quando mensal: ex. 1º domingo do mês      |

As colunas `tipo`, `permite_alunas`, `dia_semana`, `hora`, `ativo` já existem no esquema atual (por migrações anteriores ou criação da tabela).

## O que a aplicação já faz

No **startup do servidor**, o `server/database/db.js` chama `migrateCultosRecorrencia()`, que:

- Consulta se a coluna `tipo_recorrencia` já existe em `cultos`.
- Se **não** existir, executa:
  - `ADD COLUMN tipo_recorrencia ENUM('semanal','mensal') NOT NULL DEFAULT 'semanal'`
  - `ADD COLUMN ordem_mes TINYINT NULL`
- **Não** faz DROP, DELETE nem apaga dados.

Ou seja: ao subir a aplicação em produção, a migração é aplicada sozinha, de forma segura.

## Se quiser rodar o SQL manualmente (opcional)

Se preferir aplicar o mesmo cambio **antes** de reiniciar o servidor (por exemplo, em janela de manutenção), use o script só de **adição** de colunas:

**Arquivo:** `server/database/migrations/cultos_recorrencia_producao.sql`

- Contém apenas `ALTER TABLE cultos ADD COLUMN ...`.
- **Não** apaga nem deleta nada.
- Se as colunas já existirem, o MySQL pode retornar erro de “Duplicate column name”; nesse caso a migração já foi aplicada e pode ignorar.

Comando exemplo (MySQL/MariaDB):

```bash
mysql -u USUARIO -p NOME_DO_BANCO < server/database/migrations/cultos_recorrencia_producao.sql
```

## Resumo

- **Alteração no banco:** apenas **adição** de duas colunas em `cultos`: `tipo_recorrencia` e `ordem_mes`.
- **Seguro para produção:** não há DROP, TRUNCATE nem DELETE; dados existentes são mantidos; registros antigos recebem `tipo_recorrencia = 'semanal'` por DEFAULT.
- **Quando aplicar:** ao fazer deploy da versão que contém a tela Cultos v2.0, a migração roda no startup; ou execute o SQL manualmente uma vez, se preferir.
