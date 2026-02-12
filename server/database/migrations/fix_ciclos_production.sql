-- =====================================================
-- MIGRAÇÃO DE EMERGÊNCIA: RECUPERAÇÃO DA TABELA CICLOS
-- =====================================================
-- Data: 2026-02-12
-- Objetivo: Criar tabela ciclos e migrar dados existentes
-- IMPORTANTE: Este script preserva TODOS os dados existentes
-- =====================================================

-- Passo 1: Criar a tabela ciclos se não existir
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

-- Passo 2: Adicionar coluna ciclo_id em ciclo_itens se não existir
SET @dbname = DATABASE();
SET @tablename = 'ciclo_itens';
SET @columnname = 'ciclo_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT NULL AFTER igreja_id')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Passo 3: Adicionar índice em ciclo_id se não existir
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = 'ciclo_id')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX (ciclo_id)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Passo 4: Adicionar foreign key se não existir
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (constraint_name = 'ciclo_itens_ibfk_3')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD CONSTRAINT ciclo_itens_ibfk_3 FOREIGN KEY (ciclo_id) REFERENCES ciclos(id) ON DELETE CASCADE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =====================================================
-- Passo 5: MIGRAR DADOS de ciclo_organistas para ciclos
-- =====================================================

-- 5.1: Para cada igreja, criar registros na tabela ciclos baseado nos dados existentes
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
WHERE NOT EXISTS (
    SELECT 1 FROM ciclos c 
    WHERE c.igreja_id = co.igreja_id 
    AND c.ordem = co.ciclo
)
ORDER BY co.igreja_id, co.ciclo;

-- 5.2: Atualizar ciclo_itens com os IDs corretos da tabela ciclos
-- Primeiro, limpar ciclo_id existente (se houver)
UPDATE ciclo_itens SET ciclo_id = NULL WHERE ciclo_id IS NOT NULL;

-- Agora, preencher ciclo_id baseado no numero_ciclo e igreja_id
UPDATE ciclo_itens ci
INNER JOIN ciclos c ON c.igreja_id = ci.igreja_id AND c.ordem = ci.numero_ciclo
SET ci.ciclo_id = c.id;

-- 5.3: Migrar dados de ciclo_organistas que não estão em ciclo_itens
INSERT IGNORE INTO ciclo_itens (igreja_id, numero_ciclo, ciclo_id, organista_id, posicao, created_at)
SELECT 
    co.igreja_id,
    co.ciclo as numero_ciclo,
    c.id as ciclo_id,
    co.organista_id,
    co.ordem as posicao,
    NOW() as created_at
FROM ciclo_organistas co
INNER JOIN ciclos c ON c.igreja_id = co.igreja_id AND c.ordem = co.ciclo
WHERE NOT EXISTS (
    SELECT 1 FROM ciclo_itens ci 
    WHERE ci.igreja_id = co.igreja_id 
    AND ci.numero_ciclo = co.ciclo 
    AND ci.organista_id = co.organista_id
);

-- =====================================================
-- Passo 6: VERIFICAÇÃO - Mostrar o que foi migrado
-- =====================================================

-- Contar registros na tabela ciclos
SELECT 'Ciclos criados:' as status, COUNT(*) as total, igreja_id 
FROM ciclos 
GROUP BY igreja_id
ORDER BY igreja_id;

-- Contar registros em ciclo_itens com ciclo_id preenchido
SELECT 'Itens migrados:' as status, COUNT(*) as total, igreja_id 
FROM ciclo_itens 
WHERE ciclo_id IS NOT NULL
GROUP BY igreja_id
ORDER BY igreja_id;

-- Mostrar estrutura dos ciclos por igreja
SELECT 
    i.id as igreja_id,
    i.nome as igreja,
    c.id as ciclo_id,
    c.nome as ciclo_nome,
    c.ordem,
    COUNT(ci.id) as total_organistas
FROM igrejas i
LEFT JOIN ciclos c ON c.igreja_id = i.id
LEFT JOIN ciclo_itens ci ON ci.ciclo_id = c.id
GROUP BY i.id, c.id
ORDER BY i.id, c.ordem;

-- =====================================================
-- SCRIPT CONCLUÍDO
-- =====================================================
-- PRÓXIMOS PASSOS:
-- 1. Execute este script na produção
-- 2. Verifique os resultados das queries de verificação
-- 3. Teste a interface /ciclos no navegador
-- 4. Se tudo estiver OK, a tabela ciclo_organistas pode
--    ser mantida como backup por enquanto
-- =====================================================
