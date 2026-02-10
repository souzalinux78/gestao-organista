-- Script para adicionar coluna 'funcao' na tabela rodizios
-- Execute este script no MySQL Workbench ou via linha de comando

USE gestao_organista;

-- Verificar se a coluna já existe (opcional, apenas para verificação)
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'gestao_organista' 
AND TABLE_NAME = 'rodizios' 
AND COLUMN_NAME = 'funcao';

-- Adicionar coluna funcao se não existir
ALTER TABLE rodizios 
ADD COLUMN IF NOT EXISTS funcao ENUM('meia_hora', 'tocar_culto') NOT NULL DEFAULT 'tocar_culto' 
AFTER dia_semana;

-- Atualizar rodízios existentes para ter função padrão
UPDATE rodizios 
SET funcao = 'tocar_culto' 
WHERE funcao IS NULL OR funcao = '';

-- Adicionar índice único (pode dar erro se já existir, mas não é problema)
-- Se der erro, ignore esta linha
ALTER TABLE rodizios 
ADD UNIQUE KEY IF NOT EXISTS unique_rodizio_culto_funcao (culto_id, data_culto, funcao);

-- Verificar se foi criada corretamente
DESCRIBE rodizios;
