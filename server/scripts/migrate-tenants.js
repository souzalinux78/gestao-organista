/**
 * MIGRAÇÃO 001-002: Fundação Multi-Tenant
 * FASE 1: Criar tabela tenants e adicionar tenant_id em usuarios
 * 
 * Esta migração é 100% segura:
 * - Cria apenas a tabela tenants
 * - Adiciona coluna tenant_id nullable
 * - Migra usuários existentes para tenant padrão
 * - Não quebra funcionalidades existentes
 * 
 * Data: 2025-01-26
 */

const db = require('../database/db');

async function migrateTenants() {
  const pool = db.getDb();
  
  try {
    console.log('🔄 Iniciando migração multi-tenant (FASE 1)...');
    
    // ============================================
    // PASSO 1: Criar tabela tenants
    // ============================================
    console.log('📦 Criando tabela tenants...');
    
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        ativo TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tenants_slug (slug),
        INDEX idx_tenants_ativo (ativo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Tabela tenants criada!');
    
    // ============================================
    // PASSO 2: Criar tenant padrão
    // ============================================
    console.log('📦 Criando tenant padrão...');
    
    await pool.execute(`
      INSERT INTO tenants (nome, slug, ativo)
      VALUES ('Tenant Padrão', 'default', 1)
      ON DUPLICATE KEY UPDATE nome = nome
    `);
    
    const [tenants] = await pool.execute(
      'SELECT id FROM tenants WHERE slug = ?',
      ['default']
    );
    
    if (tenants.length === 0) {
      throw new Error('Falha ao criar tenant padrão');
    }
    
    const defaultTenantId = tenants[0].id;
    console.log(`✅ Tenant padrão criado (ID: ${defaultTenantId})`);
    
    // ============================================
    // PASSO 3: Adicionar tenant_id em usuarios
    // ============================================
    console.log('📦 Adicionando coluna tenant_id em usuarios...');
    
    // Verificar se coluna já existe
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'usuarios' 
        AND COLUMN_NAME = 'tenant_id'
    `);
    
    if (columns.length === 0) {
      // Adicionar coluna tenant_id (nullable)
      await pool.execute(`
        ALTER TABLE usuarios
        ADD COLUMN tenant_id INT NULL
        AFTER id
      `);
      
      // Adicionar índice
      await pool.execute(`
        ALTER TABLE usuarios
        ADD INDEX idx_usuarios_tenant (tenant_id)
      `);
      
      // Adicionar foreign key (se possível)
      try {
        await pool.execute(`
          ALTER TABLE usuarios
          ADD CONSTRAINT fk_usuarios_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
        `);
      } catch (error) {
        // Ignorar se foreign key já existir ou se houver dados incompatíveis
        if (error.code !== 'ER_DUP_KEY' && error.code !== 'ER_CANNOT_ADD_FOREIGN') {
          console.warn('⚠️  Aviso ao adicionar foreign key:', error.message);
        }
      }
      
      console.log('✅ Coluna tenant_id adicionada!');
    } else {
      console.log('ℹ️  Coluna tenant_id já existe.');
    }
    
    // ============================================
    // PASSO 4: Migrar usuários existentes
    // ============================================
    console.log('📦 Migrando usuários existentes para tenant padrão...');
    
    const [result] = await pool.execute(`
      UPDATE usuarios
      SET tenant_id = ?
      WHERE tenant_id IS NULL
    `, [defaultTenantId]);
    
    console.log(`✅ ${result.affectedRows} usuário(s) migrado(s) para tenant padrão!`);
    
    // ============================================
    // PASSO 5: Verificar migração
    // ============================================
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) AS total_usuarios,
        COUNT(tenant_id) AS usuarios_com_tenant,
        COUNT(*) - COUNT(tenant_id) AS usuarios_sem_tenant
      FROM usuarios
    `);
    
    console.log('📊 Estatísticas da migração:');
    console.log(`   - Total de usuários: ${stats[0].total_usuarios}`);
    console.log(`   - Usuários com tenant: ${stats[0].usuarios_com_tenant}`);
    console.log(`   - Usuários sem tenant: ${stats[0].usuarios_sem_tenant}`);
    
    if (stats[0].usuarios_sem_tenant > 0) {
      console.warn(`⚠️  Aviso: ${stats[0].usuarios_sem_tenant} usuário(s) sem tenant!`);
    }
    
    console.log('✅ Migração multi-tenant (FASE 1) concluída com sucesso!');
    
    return {
      success: true,
      defaultTenantId,
      usuariosMigrados: result.affectedRows
    };
    
  } catch (error) {
    console.error('❌ Erro na migração multi-tenant:', error);
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
      await migrateTenants();
      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('Erro fatal:', error);
      process.exit(1);
    }
  })();
}

module.exports = migrateTenants;
