-- Migração: Tabelas para Gestão de Escalas (histórico e snapshot)
-- escalas = cabeçalho (período, nome, status)
-- escala_itens = itens fixos (data, culto, organista nome texto, ciclo) para não quebrar se organista for excluída

CREATE TABLE IF NOT EXISTS `escalas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `igreja_id` INT NOT NULL,
  `nome_referencia` VARCHAR(255) NOT NULL COMMENT 'Ex: 2º Trimestre 2026',
  `data_inicio` DATE NOT NULL,
  `data_fim` DATE NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Rascunho' COMMENT 'Rascunho ou Publicada',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`igreja_id`) REFERENCES `igrejas`(`id`) ON DELETE CASCADE,
  INDEX `idx_escalas_igreja` (`igreja_id`),
  INDEX `idx_escalas_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `escala_itens` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `escala_id` INT NOT NULL,
  `data` DATE NOT NULL,
  `hora` TIME NULL COMMENT 'Hora do culto ou da meia hora',
  `culto_nome` VARCHAR(255) NOT NULL,
  `funcao` VARCHAR(30) NULL COMMENT 'meia_hora ou tocar_culto',
  `organista_id` INT NULL COMMENT 'Pode ser NULL se organista foi excluída do cadastro',
  `organista_nome` VARCHAR(255) NOT NULL COMMENT 'Texto fixo para histórico',
  `ciclo_origem` INT NOT NULL COMMENT 'Número do ciclo de onde veio (1, 2, 3...)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`escala_id`) REFERENCES `escalas`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organista_id`) REFERENCES `organistas`(`id`) ON DELETE SET NULL,
  INDEX `idx_escala_itens_escala` (`escala_id`),
  INDEX `idx_escala_itens_data` (`data`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
