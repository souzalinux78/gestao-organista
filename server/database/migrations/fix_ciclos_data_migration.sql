-- =====================================================
-- CORREÇÃO: Migrar Dados Existentes de ciclo_organistas
-- =====================================================
-- Este script corrige a migração incompleta
-- Limpa os ciclos criados manualmente e recria baseado
-- nos dados reais de ciclo_organistas
-- =====================================================

-- IMPORTANTE: Ajuste o ID da sua igreja aqui!
SET @igreja_id = 51; -- BAIRRO DO CRUZEIRO

-- =====================================================
-- Passo 1: BACKUP - Mostrar o que será deletado
-- =====================================================

SELECT 'CICLOS ATUAIS (serão deletados):' as info;
SELECT * FROM ciclos WHERE igreja_id = @igreja_id;

SELECT 'DADOS EM CICLO_ORGANISTAS (serão migrados):' as info;
SELECT ciclo, COUNT(*) as total_organistas 
FROM ciclo_organistas 
WHERE igreja_id = @igreja_id 
GROUP BY ciclo 
ORDER BY ciclo;

-- =====================================================
-- Passo 2: LIMPAR ciclos existentes dessa igreja
-- =====================================================

-- Isso vai deletar em cascata os ciclo_itens também
DELETE FROM ciclos WHERE igreja_id = @igreja_id;

-- =====================================================
-- Passo 3: RECRIAR ciclos baseado em ciclo_organistas
-- =====================================================

INSERT INTO ciclos (igreja_id, nome, ordem, ativo, created_at)
SELECT DISTINCT 
    co.igreja_id,
    CASE 
        WHEN co.ciclo = 1 THEN 'Ciclo 1'
        WHEN co.ciclo = 2 THEN 'Ciclo 2'
        WHEN co.ciclo = 3 THEN 'Ciclo 3'
        WHEN co.ciclo = 4 THEN 'Ciclo 4'
        WHEN co.ciclo = 5 THEN 'Ciclo 5'
        ELSE CONCAT('Ciclo ', co.ciclo)
    END as nome,
    co.ciclo as ordem,
    1 as ativo,
    NOW() as created_at
FROM ciclo_organistas co
WHERE co.igreja_id = @igreja_id
ORDER BY co.ciclo;

-- =====================================================
-- Passo 4: MIGRAR todos os dados para ciclo_itens
-- =====================================================

INSERT INTO ciclo_itens (igreja_id, numero_ciclo, ciclo_id, organista_id, posicao, created_at)
SELECT 
    co.igreja_id,
    co.ciclo as numero_ciclo,
    c.id as ciclo_id,
    co.organista_id,
    co.ordem as posicao,
    NOW() as created_at
FROM ciclo_organistas co
INNER JOIN ciclos c ON c.igreja_id = co.igreja_id AND c.ordem = co.ciclo
WHERE co.igreja_id = @igreja_id
ORDER BY co.ciclo, co.ordem;

-- =====================================================
-- Passo 5: VERIFICAÇÃO
-- =====================================================

SELECT 'NOVOS CICLOS CRIADOS:' as info;
SELECT c.id, c.nome, c.ordem, COUNT(ci.id) as total_organistas
FROM ciclos c
LEFT JOIN ciclo_itens ci ON ci.ciclo_id = c.id
WHERE c.igreja_id = @igreja_id
GROUP BY c.id
ORDER BY c.ordem;

SELECT 'DETALHES DE CADA CICLO:' as info;
SELECT 
    c.nome as ciclo,
    o.nome as organista,
    ci.posicao,
    o.oficializada
FROM ciclo_itens ci
INNER JOIN ciclos c ON c.id = ci.ciclo_id
INNER JOIN organistas o ON o.id = ci.organista_id
WHERE ci.igreja_id = @igreja_id
ORDER BY c.ordem, ci.posicao;

-- =====================================================
-- CONCLUÍDO!
-- =====================================================
