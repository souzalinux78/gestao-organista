-- =====================================================
-- DIAGNÓSTICO: Por que 0 escalas foram geradas?
-- =====================================================

-- 1. Verificar se as tabelas existem
SELECT 'TABELAS EXISTEM?' as info;
SHOW TABLES LIKE 'escalas';
SHOW TABLES LIKE 'escala_itens';

-- 2. Verificar cultos cadastrados para igreja 51
SELECT 'CULTOS CADASTRADOS (igreja 51):' as info;
SELECT * FROM cultos WHERE igreja_id = 51;

-- 3. Verificar ciclos com organistas
SELECT 'CICLOS COM ORGANISTAS (igreja 51):' as info;
SELECT 
    c.id as ciclo_id,
    c.nome as ciclo,
    COUNT(ci.id) as total_organistas
FROM ciclos c
LEFT JOIN ciclo_itens ci ON ci.ciclo_id = c.id
WHERE c.igreja_id = 51
GROUP BY c.id;

-- 4. Verificar se há escalas já criadas
SELECT 'ESCALAS EXISTENTES (igreja 51):' as info;
SELECT * FROM escalas WHERE igreja_id = 51 ORDER BY created_at DESC LIMIT 5;

-- 5. Verificar estrutura da tabela cultos
SELECT 'ESTRUTURA DA TABELA CULTOS:' as info;
DESCRIBE cultos;

-- =====================================================
-- FIM DO DIAGNÓSTICO
-- =====================================================
