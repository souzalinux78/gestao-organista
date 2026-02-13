-- Migração: Adicionar tipo e número aos ciclos
-- Arquivo: add_cycle_type_and_number.sql

-- 1. Adicionar colunas
ALTER TABLE ciclos 
  ADD COLUMN tipo ENUM('oficial', 'rjm') NOT NULL DEFAULT 'oficial',
  ADD COLUMN numero INT NULL;

-- 2. Classificar ciclos existentes baseado em vínculos com cultos
UPDATE ciclos c
SET c.tipo = 'rjm'
WHERE EXISTS (
  SELECT 1 FROM cultos k 
  WHERE k.ciclo_id = c.id 
  AND (k.tipo = 'rjm' OR k.eh_rjm = 1)
)
AND c.ativo = 1;

-- 3. Numerar ciclos oficiais baseado na ordem existente
-- Para cada igreja, numerar sequencialmente
SET @row_number = 0;
SET @current_igreja = NULL;

UPDATE ciclos c
JOIN (
  SELECT 
    id,
    igreja_id,
    @row_number := IF(@current_igreja = igreja_id, @row_number + 1, 1) AS num,
    @current_igreja := igreja_id
  FROM ciclos
  WHERE tipo = 'oficial' AND ativo = 1
  ORDER BY igreja_id, ordem ASC
) numbered ON c.id = numbered.id
SET c.numero = numbered.num
WHERE c.tipo = 'oficial';

-- 4. Criar índice único para garantir números únicos por igreja
CREATE UNIQUE INDEX idx_igreja_tipo_numero 
ON ciclos(igreja_id, tipo, numero)
WHERE numero IS NOT NULL;

-- 5. Remover coluna permite_rjm (não mais necessária)
ALTER TABLE organistas DROP COLUMN IF EXISTS permite_rjm;

-- 6. Verificação
SELECT 
  id, 
  igreja_id, 
  nome, 
  tipo, 
  numero, 
  ordem,
  ativo
FROM ciclos
WHERE ativo = 1
ORDER BY igreja_id, tipo, numero, ordem;
