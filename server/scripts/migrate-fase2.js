/**
 * MIGRAÇÃO FASE 2: Adicionar tenant_id em igrejas e organistas
 * FASE 2: Isolamento de Dados
 * 
 * Esta migração é 100% segura:
 * - Adiciona coluna tenant_id (nullable)
 * - Migra dados existentes para tenant padrão
 * - Não quebra funcionalidades existentes
 * 
 * IMPORTANTE: Execute FASE 1 primeiro!
 * 
 * Data: 2025-01-26
 */

const db = require('../database/db');

async function migrateFase2() {
  const pool = db.getDb();
  
  try {
    console.log('🔄 Iniciando migração multi-tenant FASE 2...');
    
    // Obter tenant padrão
    const [tenants] = await pool.execute(
      'SELECT id FROM tenants WHERE slug = ?',
      ['default']
    );
    
    if (tenants.length === 0) {
      throw new Error('Tenant padrão não encontrado. Execute FASE 1 primeiro!');
    }
    
    const defaultTenantId = tenants[0].id;
    console.log(`✅ Tenant padrão encontrado (ID: ${defaultTenantId})`);
    
    // ============================================
    // PARTE 1: Adicionar tenant_id em igrejas
    // ============================================
    console.log('📦 Adicionando tenant_id em igrejas...');
    
    // Verificar se coluna já existe
    const [columnsIgrejas] = await pool.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'igrejas' 
        AND COLUMN_NAME = 'tenant_id'
    `);
    
    if (columnsIgrejas.length === 0) {
      // Adicionar coluna
      await pool.execute(`
        ALTER TABLE igrejas
        ADD COLUMN tenant_id INT NULL AFTER id
      `);
      
      // Adicionar índice
      await pool.execute(`
        ALTER TABLE igrejas
        ADD INDEX idx_igrejas_tenant (tenant_id)
      `);
      
      // Adicionar foreign key
      try {
        await pool.execute(`
          ALTER TABLE igrejas
          ADD CONSTRAINT fk_igrejas_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
        `);
      } catch (error) {
        if (error.code !== 'ER_DUP_KEY' && error.code !== 'ER_CANNOT_ADD_FOREIGN') {
          console.warn('⚠️  Aviso ao adicionar foreign key em igrejas:', error.message);
        }
      }
      
      console.log('✅ Coluna tenant_id adicionada em igrejas!');
    } else {
      console.log('ℹ️  Coluna tenant_id já existe em igrejas.');
    }
    
    // Migrar igrejas existentes
    // Estratégia: Associar igreja ao tenant do primeiro usuário que tem acesso
    const [resultIgrejas] = await pool.execute(`
      UPDATE igrejas i
      LEFT JOIN (
        SELECT DISTINCT ui.igreja_id, u.tenant_id
        FROM usuario_igreja ui
        INNER JOIN usuarios u ON ui.usuario_id = u.id
        WHERE u.tenant_id IS NOT NULL
        ORDER BY ui.igreja_id, u.tenant_id
        LIMIT 1000
      ) AS igrejas_tenant ON i.id = igrejas_tenant.igreja_id
      SET i.tenant_id = COALESCE(igrejas_tenant.tenant_id, ?)
      WHERE i.tenant_id IS NULL
    `, [defaultTenantId]);
    
    console.log(`✅ ${resultIgrejas.affectedRows} igreja(s) migrada(s)!`);
    
    // ============================================
    // PARTE 2: Adicionar tenant_id em organistas
    // ============================================
    console.log('📦 Adicionando tenant_id em organistas...');
    
    // Verificar se coluna já existe
    const [columnsOrganistas] = await pool.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'organistas' 
        AND COLUMN_NAME = 'tenant_id'
    `);
    
    if (columnsOrganistas.length === 0) {
      // Adicionar coluna
      await pool.execute(`
        ALTER TABLE organistas
        ADD COLUMN tenant_id INT NULL AFTER id
      `);
      
      // Adicionar índice
      await pool.execute(`
        ALTER TABLE organistas
        ADD INDEX idx_organistas_tenant (tenant_id)
      `);
      
      // Adicionar foreign key
      try {
        await pool.execute(`
          ALTER TABLE organistas
          ADD CONSTRAINT fk_organistas_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
        `);
      } catch (error) {
        if (error.code !== 'ER_DUP_KEY' && error.code !== 'ER_CANNOT_ADD_FOREIGN') {
          console.warn('⚠️  Aviso ao adicionar foreign key em organistas:', error.message);
        }
      }
      
      console.log('✅ Coluna tenant_id adicionada em organistas!');
    } else {
      console.log('ℹ️  Coluna tenant_id já existe em organistas.');
    }
    
    // Migrar organistas existentes
    // Estratégia: Associar organista ao tenant da primeira igreja associada
    const [resultOrganistas] = await pool.execute(`
      UPDATE organistas o
      LEFT JOIN (
        SELECT DISTINCT oi.organista_id, i.tenant_id
        FROM organistas_igreja oi
        INNER JOIN igrejas i ON oi.igreja_id = i.id
        WHERE i.tenant_id IS NOT NULL
        ORDER BY oi.organista_id, i.tenant_id
        LIMIT 1000
      ) AS organistas_tenant ON o.id = organistas_tenant.organista_id
      SET o.tenant_id = COALESCE(organistas_tenant.tenant_id, ?)
      WHERE o.tenant_id IS NULL
    `, [defaultTenantId]);
    
    console.log(`✅ ${resultOrganistas.affectedRows} organista(s) migrada(s)!`);
    
    // ============================================
    // Verificação final
    // ============================================
    const [statsIgrejas] = await pool.execute(`
      SELECT 
        COUNT(*) AS total,
        COUNT(tenant_id) AS com_tenant,
        COUNT(*) - COUNT(tenant_id) AS sem_tenant
      FROM igrejas
    `);
    
    const [statsOrganistas] = await pool.execute(`
      SELECT 
        COUNT(*) AS total,
        COUNT(tenant_id) AS com_tenant,
        COUNT(*) - COUNT(tenant_id) AS sem_tenant
      FROM organistas
    `);
    
    console.log('📊 Estatísticas da migração FASE 2:');
    console.log(`   Igrejas:`);
    console.log(`     - Total: ${statsIgrejas[0].total}`);
    console.log(`     - Com tenant: ${statsIgrejas[0].com_tenant}`);
    console.log(`     - Sem tenant: ${statsIgrejas[0].sem_tenant}`);
    console.log(`   Organistas:`);
    console.log(`     - Total: ${statsOrganistas[0].total}`);
    console.log(`     - Com tenant: ${statsOrganistas[0].com_tenant}`);
    console.log(`     - Sem tenant: ${statsOrganistas[0].sem_tenant}`);
    
    if (statsIgrejas[0].sem_tenant > 0 || statsOrganistas[0].sem_tenant > 0) {
      console.warn(`⚠️  Aviso: Existem dados sem tenant!`);
    }
    
    console.log('✅ Migração multi-tenant FASE 2 concluída com sucesso!');
    
    return {
      success: true,
      igrejasMigradas: resultIgrejas.affectedRows,
      organistasMigradas: resultOrganistas.affectedRows
    };
    
  } catch (error) {
    console.error('❌ Erro na migração FASE 2:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  (async () => {
    try {
      // Inicializar banco se ainda não estiver inicializado
      if (!db.getDb) {
        await db.init();
      }
      await migrateFase2();
      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('Erro fatal:', error);
      process.exit(1);
    }
  })();
}

module.exports = migrateFase2;
