-- ============================================
-- MIGRAÇÃO 005: Tornar tenant_id obrigatório
-- FASE 5: Validação e Constraints
-- ============================================
-- 
-- Esta migração é SEGURA mas requer atenção:
-- 1. Garante que todos os dados têm tenant_id
-- 2. Torna tenant_id NOT NULL em todas as tabelas
-- 3. Adiciona validação de integridade
-- 
-- IMPORTANTE: Execute FASE 1, 2, 3 e 4 primeiro!
-- 
-- Data: 2025-01-26
-- ============================================

USE `gestao_organista`;

-- Obter ID do tenant padrão
SELECT id INTO @default_tenant_id FROM tenants WHERE slug = 'default' LIMIT 1;

-- Se não existir tenant padrão, criar
INSERT INTO tenants (`nome`, `slug`, `ativo`) 
VALUES ('Tenant Padrão', 'default', 1) 
ON DUPLICATE KEY UPDATE `nome` = `nome`;

SELECT id INTO @default_tenant_id FROM tenants WHERE slug = 'default' LIMIT 1;

-- ============================================
-- PARTE 1: Garantir que todos os usuários têm tenant_id
-- ============================================
SELECT COUNT(*) INTO @usuarios_sem_tenant FROM usuarios WHERE tenant_id IS NULL;

SELECT CONCAT('Usuários sem tenant: ', @usuarios_sem_tenant) AS status;

IF @usuarios_sem_tenant > 0 THEN
  UPDATE usuarios SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
  SELECT CONCAT('✅ ', @usuarios_sem_tenant, ' usuário(s) atualizado(s) com tenant padrão') AS status;
END IF;

-- ============================================
-- PARTE 2: Garantir que todas as igrejas têm tenant_id
-- ============================================
SELECT COUNT(*) INTO @igrejas_sem_tenant FROM igrejas WHERE tenant_id IS NULL;

SELECT CONCAT('Igrejas sem tenant: ', @igrejas_sem_tenant) AS status;

IF @igrejas_sem_tenant > 0 THEN
  -- Associar igrejas ao tenant do primeiro usuário que tem acesso
  UPDATE igrejas i
  LEFT JOIN (
    SELECT DISTINCT ui.igreja_id, u.tenant_id
    FROM usuario_igreja ui
    INNER JOIN usuarios u ON ui.usuario_id = u.id
    WHERE u.tenant_id IS NOT NULL
    ORDER BY ui.igreja_id, u.tenant_id
    LIMIT 1000
  ) AS igrejas_tenant ON i.id = igrejas_tenant.igreja_id
  SET i.tenant_id = COALESCE(igrejas_tenant.tenant_id, @default_tenant_id)
  WHERE i.tenant_id IS NULL;
  
  SELECT CONCAT('✅ ', @igrejas_sem_tenant, ' igreja(s) atualizada(s) com tenant') AS status;
END IF;

-- ============================================
-- PARTE 3: Garantir que todos os organistas têm tenant_id
-- ============================================
SELECT COUNT(*) INTO @organistas_sem_tenant FROM organistas WHERE tenant_id IS NULL;

SELECT CONCAT('Organistas sem tenant: ', @organistas_sem_tenant) AS status;

IF @organistas_sem_tenant > 0 THEN
  -- Associar organista ao tenant da primeira igreja associada
  UPDATE organistas o
  LEFT JOIN (
    SELECT DISTINCT oi.organista_id, i.tenant_id
    FROM organistas_igreja oi
    INNER JOIN igrejas i ON oi.igreja_id = i.id
    WHERE i.tenant_id IS NOT NULL
    ORDER BY oi.organista_id, i.tenant_id
    LIMIT 1000
  ) AS organistas_tenant ON o.id = organistas_tenant.organista_id
  SET o.tenant_id = COALESCE(organistas_tenant.tenant_id, @default_tenant_id)
  WHERE o.tenant_id IS NULL;
  
  SELECT CONCAT('✅ ', @organistas_sem_tenant, ' organista(s) atualizado(s) com tenant') AS status;
END IF;

-- ============================================
-- PARTE 4: Tornar tenant_id NOT NULL em usuarios
-- ============================================
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'usuarios' 
  AND COLUMN_NAME = 'tenant_id'
  AND IS_NULLABLE = 'YES';

IF @col_exists > 0 THEN
  -- Verificar se ainda há NULLs
  SELECT COUNT(*) INTO @nulls_restantes FROM usuarios WHERE tenant_id IS NULL;
  
  IF @nulls_restantes = 0 THEN
    ALTER TABLE usuarios MODIFY COLUMN tenant_id INT NOT NULL;
    SELECT '✅ Coluna tenant_id tornada NOT NULL em usuarios' AS status;
  ELSE
    SELECT CONCAT('⚠️  Ainda existem ', @nulls_restantes, ' usuários sem tenant_id. Corrija antes de tornar NOT NULL.') AS status;
  END IF;
ELSE
  SELECT 'ℹ️  Coluna tenant_id já é NOT NULL em usuarios' AS status;
END IF;

-- ============================================
-- PARTE 5: Tornar tenant_id NOT NULL em igrejas
-- ============================================
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'igrejas' 
  AND COLUMN_NAME = 'tenant_id'
  AND IS_NULLABLE = 'YES';

IF @col_exists > 0 THEN
  -- Verificar se ainda há NULLs
  SELECT COUNT(*) INTO @nulls_restantes FROM igrejas WHERE tenant_id IS NULL;
  
  IF @nulls_restantes = 0 THEN
    ALTER TABLE igrejas MODIFY COLUMN tenant_id INT NOT NULL;
    SELECT '✅ Coluna tenant_id tornada NOT NULL em igrejas' AS status;
  ELSE
    SELECT CONCAT('⚠️  Ainda existem ', @nulls_restantes, ' igrejas sem tenant_id. Corrija antes de tornar NOT NULL.') AS status;
  END IF;
ELSE
  SELECT 'ℹ️  Coluna tenant_id já é NOT NULL em igrejas' AS status;
END IF;

-- ============================================
-- PARTE 6: Tornar tenant_id NOT NULL em organistas
-- ============================================
SELECT COUNT(*) INTO @col_exists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'organistas' 
  AND COLUMN_NAME = 'tenant_id'
  AND IS_NULLABLE = 'YES';

IF @col_exists > 0 THEN
  -- Verificar se ainda há NULLs
  SELECT COUNT(*) INTO @nulls_restantes FROM organistas WHERE tenant_id IS NULL;
  
  IF @nulls_restantes = 0 THEN
    ALTER TABLE organistas MODIFY COLUMN tenant_id INT NOT NULL;
    SELECT '✅ Coluna tenant_id tornada NOT NULL em organistas' AS status;
  ELSE
    SELECT CONCAT('⚠️  Ainda existem ', @nulls_restantes, ' organistas sem tenant_id. Corrija antes de tornar NOT NULL.') AS status;
  END IF;
ELSE
  SELECT 'ℹ️  Coluna tenant_id já é NOT NULL em organistas' AS status;
END IF;

-- ============================================
-- Verificação final
-- ============================================
SELECT 
  (SELECT COUNT(*) FROM usuarios WHERE tenant_id IS NULL) AS usuarios_sem_tenant,
  (SELECT COUNT(*) FROM igrejas WHERE tenant_id IS NULL) AS igrejas_sem_tenant,
  (SELECT COUNT(*) FROM organistas WHERE tenant_id IS NULL) AS organistas_sem_tenant;

SELECT '✅ Migração FASE 5 concluída!' AS status;
