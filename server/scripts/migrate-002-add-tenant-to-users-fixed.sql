-- ============================================
-- MIGRAÇÃO 002: Adicionar tenant_id em usuarios (VERSÃO CORRIGIDA)
-- FASE 1: Fundação Multi-Tenant
-- ============================================
-- 
-- Esta migração é 100% segura:
-- - Adiciona coluna tenant_id (nullable)
-- - Migra usuários existentes para tenant padrão
-- - Não quebra funcionalidades existentes
-- 
-- IMPORTANTE: Execute migrate-001 primeiro!
-- 
-- Data: 2025-01-26
-- ============================================

USE `gestao_organista`;

-- Verificar se tenant padrão existe, se não criar
INSERT INTO tenants (`nome`, `slug`, `ativo`)
VALUES ('Tenant Padrão', 'default', 1)
ON DUPLICATE KEY UPDATE `nome` = `nome`;

-- Obter ID do tenant padrão
SET @default_tenant_id = (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1);

-- Verificar se coluna já existe antes de adicionar
SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'usuarios' 
  AND COLUMN_NAME = 'tenant_id';

-- Adicionar coluna apenas se não existir
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `usuarios` ADD COLUMN `tenant_id` INT NULL AFTER `id`',
  'SELECT "Coluna tenant_id já existe" AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar se índice já existe
SELECT COUNT(*) INTO @index_exists
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'usuarios' 
  AND INDEX_NAME = 'idx_usuarios_tenant';

-- Adicionar índice apenas se não existir
SET @sql = IF(@index_exists = 0,
  'ALTER TABLE `usuarios` ADD INDEX `idx_usuarios_tenant` (`tenant_id`)',
  'SELECT "Índice já existe" AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar se foreign key já existe
SELECT COUNT(*) INTO @fk_exists
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'usuarios' 
  AND CONSTRAINT_NAME = 'fk_usuarios_tenant';

-- Adicionar foreign key apenas se não existir
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE `usuarios` ADD CONSTRAINT `fk_usuarios_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT',
  'SELECT "Foreign key já existe" AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrar usuários existentes para tenant padrão
UPDATE `usuarios`
SET `tenant_id` = @default_tenant_id
WHERE `tenant_id` IS NULL;

-- Verificar migração
SELECT 
  COUNT(*) AS total_usuarios,
  COUNT(tenant_id) AS usuarios_com_tenant,
  COUNT(*) - COUNT(tenant_id) AS usuarios_sem_tenant
FROM usuarios;

SELECT '✅ Coluna tenant_id adicionada e usuários migrados!' AS status;
