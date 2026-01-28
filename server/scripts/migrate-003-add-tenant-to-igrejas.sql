-- ============================================
-- MIGRAÇÃO 003: Adicionar tenant_id em igrejas
-- FASE 2: Isolamento de Dados
-- ============================================
-- 
-- Esta migração é 100% segura:
-- - Adiciona coluna tenant_id (nullable)
-- - Migra igrejas existentes para tenant padrão
-- - Não quebra funcionalidades existentes
-- 
-- IMPORTANTE: Execute FASE 1 primeiro!
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
  AND TABLE_NAME = 'igrejas' 
  AND COLUMN_NAME = 'tenant_id';

-- Adicionar coluna tenant_id em igrejas (nullable inicialmente) apenas se não existir
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `igrejas` ADD COLUMN `tenant_id` INT NULL AFTER `id`',
  'SELECT "Coluna tenant_id já existe" AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar se índice já existe
SELECT COUNT(*) INTO @index_exists
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'igrejas' 
  AND INDEX_NAME = 'idx_igrejas_tenant';

-- Adicionar índice apenas se não existir
SET @sql = IF(@index_exists = 0,
  'ALTER TABLE `igrejas` ADD INDEX `idx_igrejas_tenant` (`tenant_id`)',
  'SELECT "Índice idx_igrejas_tenant já existe" AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar se foreign key já existe
SELECT COUNT(*) INTO @fk_exists
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'igrejas' 
  AND CONSTRAINT_NAME = 'fk_igrejas_tenant';

-- Adicionar foreign key apenas se não existir
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE `igrejas` ADD CONSTRAINT `fk_igrejas_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT',
  'SELECT "Foreign key fk_igrejas_tenant já existe" AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrar igrejas existentes para tenant padrão
-- Estratégia: Associar igrejas ao tenant do primeiro usuário que tem acesso a ela
-- Se não houver usuário associado, usar tenant padrão
UPDATE `igrejas` i
LEFT JOIN (
  SELECT DISTINCT ui.igreja_id, u.tenant_id
  FROM usuario_igreja ui
  INNER JOIN usuarios u ON ui.usuario_id = u.id
  WHERE u.tenant_id IS NOT NULL
  ORDER BY ui.igreja_id, u.tenant_id
  LIMIT 1000
) AS igrejas_tenant ON i.id = igrejas_tenant.igreja_id
SET i.tenant_id = COALESCE(igrejas_tenant.tenant_id, @default_tenant_id)
WHERE i.tenant_id IS NULL;

-- Verificar migração
SELECT 
  COUNT(*) AS total_igrejas,
  COUNT(tenant_id) AS igrejas_com_tenant,
  COUNT(*) - COUNT(tenant_id) AS igrejas_sem_tenant
FROM igrejas;

SELECT '✅ Coluna tenant_id adicionada em igrejas e dados migrados!' AS status;
