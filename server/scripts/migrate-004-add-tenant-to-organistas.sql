-- ============================================
-- MIGRAÇÃO 004: Adicionar tenant_id em organistas
-- FASE 2: Isolamento de Dados
-- ============================================
-- 
-- Esta migração é 100% segura:
-- - Adiciona coluna tenant_id (nullable)
-- - Migra organistas existentes para tenant padrão
-- - Não quebra funcionalidades existentes
-- 
-- IMPORTANTE: Execute FASE 1 e migrate-003 primeiro!
-- 
-- Data: 2025-01-26
-- ============================================

USE `gestao_organista`;

-- Obter ID do tenant padrão
SET @default_tenant_id = (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1);

-- Verificar se coluna tenant_id já existe
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'organistas' 
  AND COLUMN_NAME = 'tenant_id';

-- Adicionar coluna tenant_id em organistas (nullable inicialmente) apenas se não existir
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `organistas` ADD COLUMN `tenant_id` INT NULL AFTER `id`',
  'SELECT "Coluna tenant_id já existe" AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar se índice já existe
SELECT COUNT(*) INTO @index_exists
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'organistas' 
  AND INDEX_NAME = 'idx_organistas_tenant';

-- Adicionar índice apenas se não existir
SET @sql = IF(@index_exists = 0,
  'ALTER TABLE `organistas` ADD INDEX `idx_organistas_tenant` (`tenant_id`)',
  'SELECT "Índice idx_organistas_tenant já existe" AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar se foreign key já existe
SELECT COUNT(*) INTO @fk_exists
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'organistas' 
  AND CONSTRAINT_NAME = 'fk_organistas_tenant';

-- Adicionar foreign key apenas se não existir
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE `organistas` ADD CONSTRAINT `fk_organistas_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT',
  'SELECT "Foreign key fk_organistas_tenant já existe" AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrar organistas existentes para tenant padrão
-- Estratégia: Associar organista ao tenant da primeira igreja que ela está associada
-- Se não houver igreja associada, usar tenant padrão
UPDATE `organistas` o
LEFT JOIN (
  SELECT DISTINCT oi.organista_id, i.tenant_id
  FROM organistas_igreja oi
  INNER JOIN igrejas i ON oi.igreja_id = i.id
  WHERE i.tenant_id IS NOT NULL
  ORDER BY oi.organista_id, i.tenant_id
  LIMIT 1000
) AS organistas_tenant ON o.id = organistas_tenant.organista_id
SET o.tenant_id = COALESCE(organistas_tenant.tenant_id, @default_tenant_id)
WHERE o.tenant_id IS NULL;

-- Verificar migração
SELECT 
  COUNT(*) AS total_organistas,
  COUNT(tenant_id) AS organistas_com_tenant,
  COUNT(*) - COUNT(tenant_id) AS organistas_sem_tenant
FROM organistas;

SELECT '✅ Coluna tenant_id adicionada em organistas e dados migrados!' AS status;
