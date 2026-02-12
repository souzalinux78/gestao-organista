-- =====================================================
-- CORREÇÃO: Adicionar coluna 'ciclo' na tabela rodizios
-- =====================================================

-- Ver estrutura atual
SELECT 'ANTES DA CORREÇÃO:' as info;
DESCRIBE rodizios;

-- Adicionar coluna 'ciclo' se não existir
SET @dbname = DATABASE();
SET @tablename = 'rodizios';
SET @columnname = 'ciclo';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT NULL AFTER periodo_fim')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Adicionar índice
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE table_name = @tablename AND table_schema = @dbname AND index_name = 'idx_ciclo') > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX idx_ciclo (ciclo)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Copiar dados de ciclo_origem para ciclo (se houver)
UPDATE rodizios SET ciclo = ciclo_origem WHERE ciclo IS NULL AND ciclo_origem IS NOT NULL;

-- Ver estrutura depois
SELECT 'DEPOIS DA CORREÇÃO:' as info;
DESCRIBE rodizios;

-- Ver dados recentes
SELECT 'ÚLTIMOS RODÍZIOS (igreja 51):' as info;
SELECT 
    id,
    data_culto,
    dia_semana,
    funcao,
    ciclo_origem,
    ciclo,
    organista_id
FROM rodizios 
WHERE igreja_id = 51
ORDER BY data_culto DESC, id DESC
LIMIT 10;

-- =====================================================
-- CONCLUÍDO!
-- =====================================================
