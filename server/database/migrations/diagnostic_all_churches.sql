-- =====================================================
-- DIAGNÓSTICO: Verificar ciclos em TODAS as igrejas
-- =====================================================

-- 1. Mostrar TODAS as igrejas que têm dados em ciclo_itens
SELECT '========== IGREJAS COM DADOS ==========' as info;

SELECT DISTINCT
    i.id as igreja_id,
    i.nome as igreja,
    COUNT(DISTINCT ci.ciclo_id) as total_ciclos_com_dados,
    COUNT(ci.id) as total_organistas
FROM igrejas i
INNER JOIN ciclo_itens ci ON ci.igreja_id = i.id
GROUP BY i.id
ORDER BY i.id;

-- 2. Listar TODOS os ciclos de TODAS as igrejas (incluindo vazios)
SELECT '========== TODOS OS CICLOS (incluindo vazios) ==========' as info;

SELECT 
    i.nome as igreja,
    c.id as ciclo_id,
    c.nome as ciclo_nome,
    c.ordem,
    COUNT(ci.id) as total_organistas
FROM ciclos c
INNER JOIN igrejas i ON i.id = c.igreja_id
LEFT JOIN ciclo_itens ci ON ci.ciclo_id = c.id
GROUP BY c.id
ORDER BY i.id, c.ordem, c.id;

-- 3. IDENTIFICAR PROBLEMAS: Ciclos vazios
SELECT '========== CICLOS VAZIOS (possível problema) ==========' as info;

SELECT 
    i.id as igreja_id,
    i.nome as igreja,
    c.id as ciclo_id,
    c.nome as ciclo_nome,
    c.ordem
FROM ciclos c
INNER JOIN igrejas i ON i.id = c.igreja_id
LEFT JOIN ciclo_itens ci ON ci.ciclo_id = c.id
GROUP BY c.id
HAVING COUNT(ci.id) = 0
ORDER BY i.id, c.ordem;

-- 4. IDENTIFICAR PROBLEMAS: Ciclos duplicados (mesma ordem)
SELECT '========== CICLOS COM ORDEM DUPLICADA (problema) ==========' as info;

SELECT 
    c1.igreja_id,
    i.nome as igreja,
    c1.ordem,
    GROUP_CONCAT(CONCAT(c1.id, ':', c1.nome) ORDER BY c1.id) as ciclos_duplicados
FROM ciclos c1
INNER JOIN igrejas i ON i.id = c1.igreja_id
GROUP BY c1.igreja_id, c1.ordem
HAVING COUNT(*) > 1
ORDER BY c1.igreja_id, c1.ordem;

-- 5. IDENTIFICAR PROBLEMAS: Ciclo_itens sem ciclo_id
SELECT '========== ITENS SEM CICLO_ID (dados órfãos) ==========' as info;

SELECT 
    i.id as igreja_id,
    i.nome as igreja,
    COUNT(ci.id) as total_orfaos
FROM ciclo_itens ci
INNER JOIN igrejas i ON i.id = ci.igreja_id
WHERE ci.ciclo_id IS NULL
GROUP BY i.id
HAVING COUNT(ci.id) > 0
ORDER BY i.id;

-- =====================================================
-- FIM DO DIAGNÓSTICO
-- =====================================================
