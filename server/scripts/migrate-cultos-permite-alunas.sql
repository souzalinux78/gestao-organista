-- Migração: Coluna permite_alunas na tabela cultos
-- Se 0 (False), alunas são proibidas neste culto (nem meia hora).
-- Default 1 (True) mantém comportamento atual.

ALTER TABLE `cultos`
  ADD COLUMN `permite_alunas` TINYINT(1) NOT NULL DEFAULT 1
  COMMENT '1 = permite alunas (meia hora); 0 = apenas oficializadas'
  AFTER `ativo`;
