-- Migração SEGURA para produção: Recorrência em Cultos (Cultos v2.0)
-- Não apaga nem deleta dados. Apenas ADICIONA colunas se ainda não existirem.
-- Execute UMA VEZ. Se der erro "Duplicate column name", as colunas já existem (pode ignorar).

ALTER TABLE cultos
  ADD COLUMN tipo_recorrencia ENUM('semanal','mensal') NOT NULL DEFAULT 'semanal',
  ADD COLUMN ordem_mes TINYINT NULL;
