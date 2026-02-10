-- ============================================
-- Script de Criação do Banco de Dados
-- Sistema de Gestão de Organistas
-- ============================================

-- Criar banco de dados
CREATE DATABASE IF NOT EXISTS `gestao_organista` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Usar o banco de dados
USE `gestao_organista`;

-- ============================================
-- Tabela: organistas
-- ============================================
CREATE TABLE IF NOT EXISTS `organistas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ordem` INT,
  `nome` VARCHAR(255) NOT NULL,
  `telefone` VARCHAR(20),
  `email` VARCHAR(255),
  `oficializada` TINYINT(1) DEFAULT 0,
  `ativa` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_organistas_ordem` (`ordem`),
  INDEX `idx_organistas_ativa` (`ativa`),
  INDEX `idx_organistas_oficializada` (`oficializada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabela: igrejas
-- ============================================
CREATE TABLE IF NOT EXISTS `igrejas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nome` VARCHAR(255) NOT NULL,
  `endereco` TEXT,
  `encarregado_local_nome` VARCHAR(255),
  `encarregado_local_telefone` VARCHAR(20),
  `encarregado_regional_nome` VARCHAR(255),
  `encarregado_regional_telefone` VARCHAR(20),
  `mesma_organista_ambas_funcoes` TINYINT(1) DEFAULT 0,
  `rodizio_ciclo` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_igrejas_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabela: cultos
-- ============================================
CREATE TABLE IF NOT EXISTS `cultos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `igreja_id` INT NOT NULL,
  `dia_semana` VARCHAR(20) NOT NULL,
  `hora` TIME NOT NULL,
  `ativo` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`igreja_id`) REFERENCES `igrejas`(`id`) ON DELETE CASCADE,
  INDEX `idx_cultos_igreja` (`igreja_id`),
  INDEX `idx_cultos_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabela: organistas_igreja
-- Relação entre organistas e igrejas
-- ============================================
CREATE TABLE IF NOT EXISTS `organistas_igreja` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `organista_id` INT NOT NULL,
  `igreja_id` INT NOT NULL,
  `oficializada` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`organista_id`) REFERENCES `organistas`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`igreja_id`) REFERENCES `igrejas`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_organista_igreja` (`organista_id`, `igreja_id`),
  INDEX `idx_organistas_igreja_organista` (`organista_id`),
  INDEX `idx_organistas_igreja_igreja` (`igreja_id`),
  INDEX `idx_organistas_igreja_oficializada` (`oficializada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabela: rodizios
-- ============================================
CREATE TABLE IF NOT EXISTS `rodizios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `igreja_id` INT NOT NULL,
  `culto_id` INT NOT NULL,
  `organista_id` INT NOT NULL,
  `data_culto` DATE NOT NULL,
  `hora_culto` TIME NOT NULL,
  `dia_semana` VARCHAR(20) NOT NULL,
  `funcao` ENUM('meia_hora', 'tocar_culto') NOT NULL DEFAULT 'tocar_culto',
  `periodo_inicio` DATE NOT NULL,
  `periodo_fim` DATE NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`igreja_id`) REFERENCES `igrejas`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`culto_id`) REFERENCES `cultos`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organista_id`) REFERENCES `organistas`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_rodizio_culto_funcao` (`culto_id`, `data_culto`, `funcao`),
  INDEX `idx_rodizios_igreja` (`igreja_id`),
  INDEX `idx_rodizios_culto` (`culto_id`),
  INDEX `idx_rodizios_organista` (`organista_id`),
  INDEX `idx_rodizios_data` (`data_culto`),
  INDEX `idx_rodizios_funcao` (`funcao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabela: notificacoes
-- Histórico de notificações enviadas
-- ============================================
CREATE TABLE IF NOT EXISTS `notificacoes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rodizio_id` INT NOT NULL,
  `tipo` VARCHAR(50) NOT NULL,
  `enviada` TINYINT(1) DEFAULT 0,
  `data_envio` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`rodizio_id`) REFERENCES `rodizios`(`id`) ON DELETE CASCADE,
  INDEX `idx_notificacoes_rodizio` (`rodizio_id`),
  INDEX `idx_notificacoes_tipo` (`tipo`),
  INDEX `idx_notificacoes_enviada` (`enviada`),
  INDEX `idx_notificacoes_data_envio` (`data_envio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabela: usuarios
-- Usuários do sistema (admin e usuários comuns)
-- ============================================
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nome` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `senha_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'usuario') DEFAULT 'usuario',
  `ativo` TINYINT(1) DEFAULT 1,
  `aprovado` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_usuarios_email` (`email`),
  INDEX `idx_usuarios_role` (`role`),
  INDEX `idx_usuarios_ativo` (`ativo`),
  INDEX `idx_usuarios_aprovado` (`aprovado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabela: usuario_igreja
-- Associação entre usuários e igrejas
-- ============================================
CREATE TABLE IF NOT EXISTS `usuario_igreja` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `igreja_id` INT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`igreja_id`) REFERENCES `igrejas`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_usuario_igreja` (`usuario_id`, `igreja_id`),
  INDEX `idx_usuario_igreja_usuario` (`usuario_id`),
  INDEX `idx_usuario_igreja_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Verificar se as tabelas foram criadas
-- ============================================
SHOW TABLES;

-- ============================================
-- Verificar estrutura das tabelas
-- ============================================
-- DESCRIBE organistas;
-- DESCRIBE igrejas;
-- DESCRIBE cultos;
-- DESCRIBE organistas_igreja;
-- DESCRIBE rodizios;
-- DESCRIBE notificacoes;
-- DESCRIBE usuarios;
-- DESCRIBE usuario_igreja;
