-- ============================================
-- MIGRAÇÃO 002: Adicionar tenant_id em usuarios (VERSÃO SIMPLIFICADA)
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

-- Adicionar coluna tenant_id (ignorar erro se já existir)
-- NOTA: Se a coluna já existir, o erro será ignorado manualmente
ALTER TABLE `usuarios`
ADD COLUMN `tenant_id` INT NULL AFTER `id`;

-- Adicionar índice (ignorar erro se já existir)
ALTER TABLE `usuarios`
ADD INDEX `idx_usuarios_tenant` (`tenant_id`);

-- Adicionar foreign key (ignorar erro se já existir)
ALTER TABLE `usuarios`
ADD CONSTRAINT `fk_usuarios_tenant` 
FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;

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
