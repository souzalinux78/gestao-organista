-- ============================================
-- Migração: Adicionar campo de contato para aviso de escala
-- Sistema de Gestão de Organistas
-- ============================================
-- 
-- Este campo permite que um encarregado ou responsável receba
-- uma cópia da mensagem enviada à organista quando ela for escalada.
-- Campo OPCIONAL - se não preenchido, o sistema funciona normalmente.

-- Verificar se a coluna já existe antes de adicionar
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'igrejas'
    AND COLUMN_NAME = 'contato_aviso_escala_telefone'
);

-- Adicionar coluna apenas se não existir
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `igrejas` ADD COLUMN `contato_aviso_escala_telefone` VARCHAR(20) NULL AFTER `encarregado_regional_telefone`',
  'SELECT "Coluna contato_aviso_escala_telefone já existe" AS mensagem'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Log de confirmação
SELECT 'Migração concluída: Campo contato_aviso_escala_telefone adicionado à tabela igrejas' AS resultado;
