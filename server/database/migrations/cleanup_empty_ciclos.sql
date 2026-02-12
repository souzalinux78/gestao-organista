-- =====================================================
-- LIMPEZA: Deletar TODOS os ciclos vazios
-- =====================================================
-- Mantém apenas ciclos com organistas cadastrados
-- =====================================================

-- Ver quantos ciclos serão deletados
SELECT 'CICLOS VAZIOS QUE SERÃO DELETADOS:' as info;

SELECT COUNT(*) as total_ciclos_vazios
FROM ciclos c
LEFT JOIN ciclo_itens ci ON ci.ciclo_id = c.id
GROUP BY c.id
HAVING COUNT(ci.id) = 0;

-- DELETAR todos os ciclos vazios
DELETE c FROM ciclos c
LEFT JOIN ciclo_itens ci ON ci.ciclo_id = c.id
WHERE c.id NOT IN (
    SELECT DISTINCT ciclo_id 
    FROM ciclo_itens 
    WHERE ciclo_id IS NOT NULL
);

-- VERIFICAÇÃO FINAL
SELECT 'SITUAÇÃO APÓS LIMPEZA:' as info;

SELECT 
    i.id as igreja_id,
    i.nome as igreja,
    COUNT(DISTINCT c.id) as total_ciclos,
    COUNT(ci.id) as total_organistas
FROM igrejas i
LEFT JOIN ciclos c ON c.igreja_id = i.id
LEFT JOIN ciclo_itens ci ON ci.ciclo_id = c.id
WHERE c.id IS NOT NULL
GROUP BY i.id
ORDER BY i.id;

-- =====================================================
-- LIMPEZA CONCLUÍDA!
-- =====================================================
-- Agora só restam ciclos com dados reais
-- =====================================================
