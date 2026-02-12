-- =====================================================
-- MIGRAÇÃO UNIVERSAL - TODAS AS IGREJAS
-- =====================================================
-- Este script migra AUTOMATICAMENTE todas as igrejas
-- que já possuem dados em ciclo_organistas ou ciclo_itens
-- =====================================================

-- =====================================================
-- Passo 1: Criar tabela ciclos (se não existir)
-- =====================================================
CREATE TABLE IF NOT EXISTS `ciclos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `igreja_id` INT NOT NULL,
  `nome` VARCHAR(100) NOT NULL,
  `ordem` INT NOT NULL DEFAULT 1,
  `ativo` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_ciclo_igreja_nome (igreja_id, nome),
  INDEX (igreja_id),
  CONSTRAINT ciclos_ibfk_1 FOREIGN KEY (igreja_id) REFERENCES igrejas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Passo 2: Adicionar coluna ciclo_id em ciclo_itens
-- =====================================================
SET @dbname = DATABASE();
SET @tablename = 'ciclo_itens';
SET @columnname = 'ciclo_id';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE table_name = @tablename AND table_schema = @dbname AND column_name = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT NULL AFTER igreja_id')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =====================================================
-- Passo 3: Adicionar índice em ciclo_id
-- =====================================================
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE table_name = @tablename AND table_schema = @dbname AND index_name = 'ciclo_id') > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX (ciclo_id)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =====================================================
-- Passo 4: Adicionar foreign key
-- =====================================================
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
   WHERE table_name = @tablename AND table_schema = @dbname AND constraint_name = 'ciclo_itens_ibfk_3') > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD CONSTRAINT ciclo_itens_ibfk_3 FOREIGN KEY (ciclo_id) REFERENCES ciclos(id) ON DELETE CASCADE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =====================================================
-- Passo 5: MIGRAR - Criar ciclos baseado em ciclo_organistas
-- =====================================================
INSERT IGNORE INTO ciclos (igreja_id, nome, ordem, ativo, created_at)
SELECT DISTINCT 
    co.igreja_id,
    CASE 
        WHEN co.ciclo = 1 THEN 'Ciclo 1'
        WHEN co.ciclo = 2 THEN 'Ciclo 2'
        WHEN co.ciclo = 3 THEN 'Ciclo 3'
        WHEN co.ciclo = 4 THEN 'Ciclo 4'
        WHEN co.ciclo = 5 THEN 'Ciclo 5'
        WHEN co.ciclo = 6 THEN 'Ciclo 6'
        WHEN co.ciclo = 7 THEN 'Ciclo 7'
        WHEN co.ciclo = 8 THEN 'Ciclo 8'
        WHEN co.ciclo = 9 THEN 'Ciclo 9'
        ELSE CONCAT('Ciclo ', co.ciclo)
    END as nome,
    co.ciclo as ordem,
    1 as ativo,
    NOW() as created_at
FROM ciclo_organistas co
ORDER BY co.igreja_id, co.ciclo;

-- Também criar ciclos baseado em ciclo_itens (para cobrir todas)
INSERT IGNORE INTO ciclos (igreja_id, nome, ordem, ativo, created_at)
SELECT DISTINCT 
    ci.igreja_id,
    CASE 
        WHEN ci.numero_ciclo = 1 THEN 'Ciclo 1'
        WHEN ci.numero_ciclo = 2 THEN 'Ciclo 2'
        WHEN ci.numero_ciclo = 3 THEN 'Ciclo 3'
        WHEN ci.numero_ciclo = 4 THEN 'Ciclo 4'
        WHEN ci.numero_ciclo = 5 THEN 'Ciclo 5'
        WHEN ci.numero_ciclo = 6 THEN 'Ciclo 6'
        WHEN ci.numero_ciclo = 7 THEN 'Ciclo 7'
        WHEN ci.numero_ciclo = 8 THEN 'Ciclo 8'
        WHEN ci.numero_ciclo = 9 THEN 'Ciclo 9'
        ELSE CONCAT('Ciclo ', ci.numero_ciclo)
    END as nome,
    ci.numero_ciclo as ordem,
    1 as ativo,
    NOW() as created_at
FROM ciclo_itens ci
WHERE ci.numero_ciclo IS NOT NULL AND ci.numero_ciclo > 0
ORDER BY ci.igreja_id, ci.numero_ciclo;

-- =====================================================
-- Passo 6: Popular ciclo_id em ciclo_itens
-- =====================================================
UPDATE ciclo_itens ci
INNER JOIN ciclos c ON c.igreja_id = ci.igreja_id AND c.ordem = ci.numero_ciclo
SET ci.ciclo_id = c.id
WHERE ci.ciclo_id IS NULL;

-- =====================================================
-- Passo 7: VERIFICAÇÃO - Resumo por Igreja
-- =====================================================

SELECT '========== RESUMO DA MIGRAÇÃO ==========' as info;

SELECT 
    i.id as igreja_id,
    i.nome as igreja,
    COUNT(DISTINCT c.id) as total_ciclos,
    COUNT(ci.id) as total_organistas_nos_ciclos
FROM igrejas i
LEFT JOIN ciclos c ON c.igreja_id = i.id
LEFT JOIN ciclo_itens ci ON ci.igreja_id = i.id AND ci.ciclo_id IS NOT NULL
WHERE c.id IS NOT NULL OR ci.id IS NOT NULL
GROUP BY i.id
ORDER BY i.id;

SELECT '========== DETALHES POR CICLO ==========' as info;

SELECT 
    i.nome as igreja,
    c.nome as ciclo,
    c.ordem,
    COUNT(ci.id) as total_organistas
FROM ciclos c
INNER JOIN igrejas i ON i.id = c.igreja_id
LEFT JOIN ciclo_itens ci ON ci.ciclo_id = c.id
GROUP BY c.id
ORDER BY i.nome, c.ordem;

-- =====================================================
-- MIGRAÇÃO CONCLUÍDA PARA TODAS AS IGREJAS!
-- =====================================================
