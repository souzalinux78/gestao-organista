-- =============================================================================
-- Script: Análise e correção Organistas / Organistas_igreja / Ciclo_itens
-- Objetivo: Alinhar o banco de produção ao que foi cadastrado (organistas e
--           ciclos), removendo referências inválidas e reordenando posições.
-- Uso: 1) Rodar as queries de ANÁLISE (comentadas ou em bloco) e revisar.
--      2) Rodar as correções (DELETE/UPDATE) em ambiente de teste primeiro.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PARTE 1 — ANÁLISE (execute e guarde o resultado antes de corrigir)
-- -----------------------------------------------------------------------------

-- 1.1) Ciclo_itens cuja organista NÃO existe em organistas (órfãos por exclusão)
SELECT 'Ciclo_itens com organista_id inexistente em organistas' AS diagnostico;
SELECT ci.id, ci.igreja_id, ci.numero_ciclo, ci.organista_id, ci.posicao
FROM ciclo_itens ci
LEFT JOIN organistas o ON o.id = ci.organista_id
WHERE o.id IS NULL;

-- 1.2) Ciclo_itens cuja organista NÃO está vinculada à igreja em organistas_igreja
SELECT 'Ciclo_itens com organista não vinculada à igreja' AS diagnostico;
SELECT ci.id, ci.igreja_id, ci.numero_ciclo, ci.organista_id, ci.posicao
FROM ciclo_itens ci
LEFT JOIN organistas_igreja oi ON oi.organista_id = ci.organista_id AND oi.igreja_id = ci.igreja_id
WHERE oi.organista_id IS NULL;

-- 1.3) Ciclo_itens com organista inativa (ativa = 0) — opcional remover
SELECT 'Ciclo_itens com organista inativa' AS diagnostico;
SELECT ci.id, ci.igreja_id, ci.numero_ciclo, ci.organista_id, o.nome, o.ativa
FROM ciclo_itens ci
INNER JOIN organistas o ON o.id = ci.organista_id
WHERE o.ativa = 0;

-- 1.4) Resumo por igreja/ciclo (quantidade de itens e se há duplicata de posição)
SELECT 'Resumo por igreja e ciclo' AS diagnostico;
SELECT ci.igreja_id, i.nome AS igreja_nome, ci.numero_ciclo,
       COUNT(*) AS total_itens,
       COUNT(DISTINCT ci.organista_id) AS organistas_unicas,
       COUNT(DISTINCT ci.posicao) AS posicoes_unicas
FROM ciclo_itens ci
LEFT JOIN igrejas i ON i.id = ci.igreja_id
GROUP BY ci.igreja_id, i.nome, ci.numero_ciclo;

-- -----------------------------------------------------------------------------
-- PARTE 2 — CORREÇÕES (execute após revisar a análise)
-- -----------------------------------------------------------------------------

-- 2.1) Remover ciclo_itens cuja organista não existe em organistas
DELETE ci FROM ciclo_itens ci
LEFT JOIN organistas o ON o.id = ci.organista_id
WHERE o.id IS NULL;

-- 2.2) Remover ciclo_itens cuja organista não está vinculada à igreja (organistas_igreja)
DELETE ci FROM ciclo_itens ci
LEFT JOIN organistas_igreja oi ON oi.organista_id = ci.organista_id AND oi.igreja_id = ci.igreja_id
WHERE oi.organista_id IS NULL;

-- 2.3) (Opcional) Remover ciclo_itens com organista inativa
-- Descomente se quiser que apenas organistas ativas figurem nos ciclos.
-- DELETE ci FROM ciclo_itens ci
-- INNER JOIN organistas o ON o.id = ci.organista_id
-- WHERE o.ativa = 0;

-- 2.4) Renumerar posicao (0, 1, 2, ...) por (igreja_id, numero_ciclo) conforme ordem atual
--      Mantém a ordem atual de cada ciclo e elimina falhas/duplicatas de posição.
--      Compatível com MySQL 5.7 e 8+. Em MySQL 8+ pode usar ROW_NUMBER (ver comentário no final).

DROP TEMPORARY TABLE IF EXISTS _ciclo_itens_ordem;
CREATE TEMPORARY TABLE _ciclo_itens_ordem (
  id INT PRIMARY KEY,
  nova_pos INT NOT NULL
);

SET @cur_igreja := NULL;
SET @cur_ciclo := NULL;
SET @pos := -1;

INSERT INTO _ciclo_itens_ordem (id, nova_pos)
SELECT id, nova_pos FROM (
  SELECT ci.id,
         @pos := IF(ci.igreja_id <=> @cur_igreja AND ci.numero_ciclo <=> @cur_ciclo, @pos + 1, 0) AS nova_pos,
         @cur_igreja := ci.igreja_id,
         @cur_ciclo := ci.numero_ciclo
  FROM ciclo_itens ci
  ORDER BY ci.igreja_id, ci.numero_ciclo, ci.posicao, ci.id
) x;

UPDATE ciclo_itens ci
INNER JOIN _ciclo_itens_ordem o ON o.id = ci.id
SET ci.posicao = o.nova_pos;

DROP TEMPORARY TABLE IF EXISTS _ciclo_itens_ordem;

-- MySQL 8+ alternativa (mais simples): substituir o INSERT acima por:
-- INSERT INTO _ciclo_itens_ordem (id, nova_pos)
-- SELECT id, ROW_NUMBER() OVER (PARTITION BY igreja_id, numero_ciclo ORDER BY posicao, id) - 1 FROM ciclo_itens;

-- -----------------------------------------------------------------------------
-- PARTE 3 — VERIFICAÇÃO PÓS-CORREÇÃO (opcional)
-- -----------------------------------------------------------------------------

-- Contagem final de ciclo_itens por igreja/ciclo
SELECT ci.igreja_id, i.nome AS igreja_nome, ci.numero_ciclo,
       COUNT(*) AS total_itens
FROM ciclo_itens ci
LEFT JOIN igrejas i ON i.id = ci.igreja_id
GROUP BY ci.igreja_id, i.nome, ci.numero_ciclo
ORDER BY ci.igreja_id, ci.numero_ciclo;
