-- =====================================================
-- CORREÇÃO: Limpar ciclos duplicados e renomear
-- =====================================================
-- Igreja: BAIRRO DO CRUZEIRO (ID 51)
-- =====================================================

-- Ver estado atual
SELECT 'ANTES DA CORREÇÃO:' as status;
SELECT c.id, c.nome, c.ordem, COUNT(ci.id) as total_organistas
FROM ciclos c
LEFT JOIN ciclo_itens ci ON ci.ciclo_id = c.id
WHERE c.igreja_id = 51
GROUP BY c.id
ORDER BY c.ordem, c.id;

-- =====================================================
-- Passo 1: Deletar ciclos vazios (128, 129)
-- =====================================================
DELETE FROM ciclos WHERE id IN (128, 129);

-- =====================================================
-- Passo 2: Renomear e corrigir ordem dos ciclos
-- =====================================================

-- Ciclo ID 51: "Cultos" → "Ciclo 1" (ordem 1)
UPDATE ciclos 
SET nome = 'Ciclo 1', ordem = 1 
WHERE id = 51;

-- Ciclo ID 114: "RJM" → "Ciclo 2" (ordem 2) 
UPDATE ciclos 
SET nome = 'Ciclo 2', ordem = 2 
WHERE id = 114;

-- Ciclo ID 127: "Ciclo 3" → manter (ordem 3)
UPDATE ciclos 
SET ordem = 3 
WHERE id = 127;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
SELECT 'DEPOIS DA CORREÇÃO:' as status;
SELECT c.id, c.nome, c.ordem, COUNT(ci.id) as total_organistas
FROM ciclos c
LEFT JOIN ciclo_itens ci ON ci.ciclo_id = c.id
WHERE c.igreja_id = 51
GROUP BY c.id
ORDER BY c.ordem;

SELECT 'ORGANISTAS POR CICLO:' as status;
SELECT 
    c.nome as ciclo,
    o.nome as organista,
    ci.posicao
FROM ciclo_itens ci
INNER JOIN ciclos c ON c.id = ci.ciclo_id
INNER JOIN organistas o ON o.id = ci.organista_id
WHERE ci.igreja_id = 51
ORDER BY c.ordem, ci.posicao;

-- =====================================================
-- CONCLUÍDO!
-- =====================================================
