-- ============================================
-- MIGRAÇÃO 001: Criar Tabela Tenants
-- FASE 1: Fundação Multi-Tenant
-- ============================================
-- 
-- Esta migração é 100% segura:
-- - Cria apenas a tabela tenants
-- - Não modifica tabelas existentes
-- - Não quebra funcionalidades
-- 
-- Data: 2025-01-26
-- ============================================

USE `gestao_organista`;

-- Criar tabela tenants
CREATE TABLE IF NOT EXISTS `tenants` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nome` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `ativo` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tenants_slug` (`slug`),
  INDEX `idx_tenants_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Criar tenant padrão para dados existentes
-- Este tenant será usado para migrar todos os dados atuais
INSERT INTO `tenants` (`nome`, `slug`, `ativo`)
VALUES ('Tenant Padrão', 'default', 1)
ON DUPLICATE KEY UPDATE `nome` = `nome`;

-- Verificar criação
SELECT '✅ Tabela tenants criada com sucesso!' AS status;
SELECT * FROM tenants;
