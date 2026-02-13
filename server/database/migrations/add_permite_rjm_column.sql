-- =====================================================
-- MIGRATION: Adicionar campo permite_rjm em organistas
-- =====================================================

-- Verificar se a coluna já existe antes de tentar adicionar
SET @dbname = DATABASE();
SET @tablename = 'organistas';
SET @columnname = 'permite_rjm';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TINYINT(1) DEFAULT 0 AFTER ativa')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Atualizar para garantir que, por padrão, ninguém tem permissão (segurança)
-- UPDATE organistas SET permite_rjm = 0 WHERE permite_rjm IS NULL;

SELECT 'Migration concluída: Coluna permite_rjm adicionada.' as info;
DESCRIBE organistas;
