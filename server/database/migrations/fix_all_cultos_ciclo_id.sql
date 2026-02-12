-- =====================================================
-- CORREÇÃO UNIVERSAL: Associar cultos aos ciclos
-- =====================================================
-- Para TODAS as igrejas que têm ciclos ativos
-- mas cultos sem ciclo_id associado
-- =====================================================

-- Ver quantas igrejas serão afetadas
SELECT 'IGREJAS QUE SERÃO CORRIGIDAS:' as info;

SELECT DISTINCT
    i.id as igreja_id,
    i.nome as igreja,
    COUNT(DISTINCT cu.id) as total_cultos_sem_ciclo,
    (SELECT COUNT(*) FROM ciclos c WHERE c.igreja_id = i.id AND c.ativo = 1) as total_ciclos_ativos
FROM igrejas i
INNER JOIN cultos cu ON cu.igreja_id = i.id
WHERE cu.ciclo_id IS NULL
AND EXISTS (SELECT 1 FROM ciclos c WHERE c.igreja_id = i.id AND c.ativo = 1)
GROUP BY i.id
ORDER BY i.id;

-- =====================================================
-- CORREÇÃO: Para cada igreja com ciclos ativos,
-- associar os cultos oficiais ao primeiro ciclo (ordem 1)
-- =====================================================

UPDATE cultos cu
INNER JOIN (
    SELECT 
        c.igreja_id,
        MIN(c.id) as primeiro_ciclo_id
    FROM ciclos c
    WHERE c.ativo = 1 AND c.ordem = 1
    GROUP BY c.igreja_id
) primeiro_ciclo ON primeiro_ciclo.igreja_id = cu.igreja_id
SET cu.ciclo_id = primeiro_ciclo.primeiro_ciclo_id
WHERE cu.ciclo_id IS NULL
AND cu.tipo = 'culto_oficial';

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

SELECT 'RESULTADO DA CORREÇÃO:' as info;

SELECT 
    i.id as igreja_id,
    i.nome as igreja,
    COUNT(DISTINCT cu.id) as total_cultos,
    COUNT(DISTINCT CASE WHEN cu.ciclo_id IS NOT NULL THEN cu.id END) as cultos_com_ciclo,
    COUNT(DISTINCT CASE WHEN cu.ciclo_id IS NULL THEN cu.id END) as cultos_sem_ciclo
FROM igrejas i
INNER JOIN cultos cu ON cu.igreja_id = i.id
WHERE EXISTS (SELECT 1 FROM ciclos c WHERE c.igreja_id = i.id)
GROUP BY i.id
ORDER BY i.id;

-- =====================================================
-- CONCLUÍDO!
-- =====================================================
