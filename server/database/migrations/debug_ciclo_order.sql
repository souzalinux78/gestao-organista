
-- Verificar ordem dos itens nos ciclos
SELECT 
    c.nome as Ciclo,
    ci.posicao,
    o.nome as Organista,
    o.categoria,
    o.permite_rjm,
    ci.igreja_id
FROM ciclo_itens ci
JOIN ciclos c ON ci.ciclo_id = c.id
JOIN organistas o ON ci.organista_id = o.id
ORDER BY ci.igreja_id, c.ordem, ci.posicao;
