-- =====================================================
-- CORREÇÃO: Associar cultos ao primeiro ciclo ativo
-- =====================================================
-- Os cultos não precisam ter ciclo_id específico,
-- mas o código atual espera isso. Vamos associar ao
-- primeiro ciclo (ordem 1) como padrão.
-- =====================================================

-- Ver estado atual
SELECT 'ANTES DA CORREÇÃO:' as info;
SELECT id, igreja_id, ciclo_id, dia_semana, hora, tipo 
FROM cultos 
WHERE igreja_id = 51;

-- Buscar o ID do primeiro ciclo (ordem 1) da igreja 51
SET @primeiro_ciclo_id = (
    SELECT id FROM ciclos 
    WHERE igreja_id = 51 AND ordem = 1 AND ativo = 1 
    LIMIT 1
);

SELECT CONCAT('Ciclo ID encontrado: ', @primeiro_ciclo_id) as info;

-- Atualizar TODOS os cultos oficiais para usar o primeiro ciclo
UPDATE cultos 
SET ciclo_id = @primeiro_ciclo_id
WHERE igreja_id = 51 
AND tipo = 'culto_oficial'
AND ciclo_id IS NULL;

SELECT 'DEPOIS DA CORREÇÃO:' as info;
SELECT id, igreja_id, ciclo_id, dia_semana, hora, tipo 
FROM cultos 
WHERE igreja_id = 51;

-- =====================================================
-- CONCLUÍDO!
-- =====================================================
-- Agora tente gerar o rodízio novamente
-- =====================================================
