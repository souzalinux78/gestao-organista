-- =====================================================
-- DIAGNÓSTICO: Por que os ciclos não alternam?
-- =====================================================

-- 1. Ver estrutura da tabela rodizios/escalas
SELECT 'ESTRUTURA DA TABELA RODIZIOS:' as info;
DESCRIBE rodizios;

SELECT 'ESTRUTURA DA TABELA ESCALAS:' as info;
DESCRIBE escalas;

SELECT 'ESTRUTURA DA TABELA ESCALA_ITENS:' as info;
DESCRIBE escala_itens;

-- 2. Ver o que está salvo na coluna ciclo (últimos 20 registros)
SELECT 'DADOS NA TABELA RODIZIOS (igreja 51):' as info;
SELECT 
    id,
    data_culto,
    dia_semana,
    funcao,
    ciclo,
    organista_id
FROM rodizios 
WHERE igreja_id = 51
ORDER BY data_culto DESC, id DESC
LIMIT 20;

-- 3. Ver dados em escala_itens
SELECT 'DADOS NA TABELA ESCALA_ITENS (igreja 51):' as info;
SELECT 
    ei.id,
    ei.data,
    ei.funcao,
    ei.ciclo_origem,
    ei.organista_nome,
    ei.organista_id
FROM escala_itens ei
INNER JOIN escalas e ON e.id = ei.escala_id
WHERE e.igreja_id = 51
ORDER BY ei.data DESC, ei.id DESC
LIMIT 20;

-- 4. Ver os ciclos cadastrados e seus IDs
SELECT 'CICLOS CADASTRADOS (igreja 51):' as info;
SELECT 
    id,
    nome,
    ordem
FROM ciclos
WHERE igreja_id = 51
ORDER BY ordem;

-- 5. Ver relação entre organistas e ciclos
SELECT 'ORGANISTAS POR CICLO (igreja 51):' as info;
SELECT 
    c.id as ciclo_id,
    c.nome as ciclo_nome,
    ci.organista_id,
    o.nome as organista_nome,
    ci.posicao
FROM ciclos c
INNER JOIN ciclo_itens ci ON ci.ciclo_id = c.id
INNER JOIN organistas o ON o.id = ci.organista_id
WHERE c.igreja_id = 51
ORDER BY c.ordem, ci.posicao;

-- =====================================================
-- FIM DO DIAGNÓSTICO
-- =====================================================
