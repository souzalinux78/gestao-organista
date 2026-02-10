/**
 * MIGRAÇÃO FASE 5: Tornar tenant_id obrigatório
 * FASE 5: Validação e Constraints
 * 
 * Esta migração é SEGURA mas requer atenção:
 * 1. Garante que todos os dados têm tenant_id
 * 2. Torna tenant_id NOT NULL em todas as tabelas
 * 3. Adiciona validação de integridade
 * 
 * IMPORTANTE: Execute FASE 1, 2, 3 e 4 primeiro!
 * 
 * Data: 2025-01-26
 */

const db = require('../database/db');

async function migrateFase5() {
  const pool = db.getDb();
  
  try {
    console.log('🔄 Iniciando migração multi-tenant FASE 5...');
    
    // Obter tenant padrão
    const [tenants] = await pool.execute(
      'SELECT id FROM tenants WHERE slug = ?',
      ['default']
    );
    
    if (tenants.length === 0) {
      // Criar tenant padrão se não existir
      await pool.execute(
        'INSERT INTO tenants (nome, slug, ativo) VALUES (?, ?, ?)',
        ['Tenant Padrão', 'default', 1]
      );
      const [newTenants] = await pool.execute(
        'SELECT id FROM tenants WHERE slug = ?',
        ['default']
      );
      var defaultTenantId = newTenants[0].id;
    } else {
      var defaultTenantId = tenants[0].id;
    }
    
    console.log(`✅ Tenant padrão encontrado (ID: ${defaultTenantId})`);
    
    // ============================================
    // PARTE 1: Garantir que todos os usuários têm tenant_id
    // ============================================
    console.log('📦 Verificando usuários sem tenant_id...');
    const [usuariosSemTenant] = await pool.execute(
      'SELECT COUNT(*) as count FROM usuarios WHERE tenant_id IS NULL'
    );
    
    if (usuariosSemTenant[0].count > 0) {
      const [result] = await pool.execute(
        'UPDATE usuarios SET tenant_id = ? WHERE tenant_id IS NULL',
        [defaultTenantId]
      );
      console.log(`✅ ${result.affectedRows} usuário(s) atualizado(s) com tenant padrão`);
    } else {
      console.log('ℹ️  Todos os usuários já têm tenant_id');
    }
    
    // ============================================
    // PARTE 2: Garantir que todas as igrejas têm tenant_id
    // ============================================
    console.log('📦 Verificando igrejas sem tenant_id...');
    const [igrejasSemTenant] = await pool.execute(
      'SELECT COUNT(*) as count FROM igrejas WHERE tenant_id IS NULL'
    );
    
    if (igrejasSemTenant[0].count > 0) {
      // Associar igrejas ao tenant do primeiro usuário que tem acesso
      const [result] = await pool.execute(`
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
      console.log(`✅ ${result.affectedRows} igreja(s) atualizada(s) com tenant`);
    } else {
      console.log('ℹ️  Todas as igrejas já têm tenant_id');
    }
    
    // ============================================
    // PARTE 3: Garantir que todos os organistas têm tenant_id
    // ============================================
    console.log('📦 Verificando organistas sem tenant_id...');
    const [organistasSemTenant] = await pool.execute(
      'SELECT COUNT(*) as count FROM organistas WHERE tenant_id IS NULL'
    );
    
    if (organistasSemTenant[0].count > 0) {
      // Associar organista ao tenant da primeira igreja associada
      const [result] = await pool.execute(`
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
      console.log(`✅ ${result.affectedRows} organista(s) atualizado(s) com tenant`);
    } else {
      console.log('ℹ️  Todos os organistas já têm tenant_id');
    }
    
    // ============================================
    // PARTE 4: Tornar tenant_id NOT NULL em usuarios
    // ============================================
    console.log('🔒 Tornando tenant_id NOT NULL em usuarios...');
    const [colUsuarios] = await pool.execute(`
      SELECT IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'usuarios' 
        AND COLUMN_NAME = 'tenant_id'
    `);
    
    if (colUsuarios.length > 0 && colUsuarios[0].IS_NULLABLE === 'YES') {
      const [nulls] = await pool.execute(
        'SELECT COUNT(*) as count FROM usuarios WHERE tenant_id IS NULL'
      );
      
      if (nulls[0].count === 0) {
        await pool.execute(
          'ALTER TABLE usuarios MODIFY COLUMN tenant_id INT NOT NULL'
        );
        console.log('✅ tenant_id tornada NOT NULL em usuarios');
      } else {
        console.warn(`⚠️  Ainda existem ${nulls[0].count} usuários sem tenant_id. Corrija antes de tornar NOT NULL.`);
      }
    } else {
      console.log('ℹ️  tenant_id já é NOT NULL em usuarios');
    }
    
    // ============================================
    // PARTE 5: Tornar tenant_id NOT NULL em igrejas
    // ============================================
    console.log('🔒 Tornando tenant_id NOT NULL em igrejas...');
    const [colIgrejas] = await pool.execute(`
      SELECT IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'igrejas' 
        AND COLUMN_NAME = 'tenant_id'
    `);
    
    if (colIgrejas.length > 0 && colIgrejas[0].IS_NULLABLE === 'YES') {
      const [nulls] = await pool.execute(
        'SELECT COUNT(*) as count FROM igrejas WHERE tenant_id IS NULL'
      );
      
      if (nulls[0].count === 0) {
        await pool.execute(
          'ALTER TABLE igrejas MODIFY COLUMN tenant_id INT NOT NULL'
        );
        console.log('✅ tenant_id tornada NOT NULL em igrejas');
      } else {
        console.warn(`⚠️  Ainda existem ${nulls[0].count} igrejas sem tenant_id. Corrija antes de tornar NOT NULL.`);
      }
    } else {
      console.log('ℹ️  tenant_id já é NOT NULL em igrejas');
    }
    
    // ============================================
    // PARTE 6: Tornar tenant_id NOT NULL em organistas
    // ============================================
    console.log('🔒 Tornando tenant_id NOT NULL em organistas...');
    const [colOrganistas] = await pool.execute(`
      SELECT IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'organistas' 
        AND COLUMN_NAME = 'tenant_id'
    `);
    
    if (colOrganistas.length > 0 && colOrganistas[0].IS_NULLABLE === 'YES') {
      const [nulls] = await pool.execute(
        'SELECT COUNT(*) as count FROM organistas WHERE tenant_id IS NULL'
      );
      
      if (nulls[0].count === 0) {
        await pool.execute(
          'ALTER TABLE organistas MODIFY COLUMN tenant_id INT NOT NULL'
        );
        console.log('✅ tenant_id tornada NOT NULL em organistas');
      } else {
        console.warn(`⚠️  Ainda existem ${nulls[0].count} organistas sem tenant_id. Corrija antes de tornar NOT NULL.`);
      }
    } else {
      console.log('ℹ️  tenant_id já é NOT NULL em organistas');
    }
    
    // ============================================
    // Verificação final
    // ============================================
    const [statsUsuarios] = await pool.execute(
      'SELECT COUNT(*) as total, COUNT(tenant_id) as com_tenant FROM usuarios'
    );
    const [statsIgrejas] = await pool.execute(
      'SELECT COUNT(*) as total, COUNT(tenant_id) as com_tenant FROM igrejas'
    );
    const [statsOrganistas] = await pool.execute(
      'SELECT COUNT(*) as total, COUNT(tenant_id) as com_tenant FROM organistas'
    );
    
    console.log('📊 Estatísticas finais:');
    console.log(`   Usuários: ${statsUsuarios[0].total} total, ${statsUsuarios[0].com_tenant} com tenant`);
    console.log(`   Igrejas: ${statsIgrejas[0].total} total, ${statsIgrejas[0].com_tenant} com tenant`);
    console.log(`   Organistas: ${statsOrganistas[0].total} total, ${statsOrganistas[0].com_tenant} com tenant`);
    
    if (statsUsuarios[0].total !== statsUsuarios[0].com_tenant ||
        statsIgrejas[0].total !== statsIgrejas[0].com_tenant ||
        statsOrganistas[0].total !== statsOrganistas[0].com_tenant) {
      console.warn('⚠️  Aviso: Existem dados sem tenant_id!');
    }
    
    console.log('✅ Migração multi-tenant FASE 5 concluída com sucesso!');
    
    return {
      success: true,
      usuariosAtualizados: statsUsuarios[0].com_tenant,
      igrejasAtualizadas: statsIgrejas[0].com_tenant,
      organistasAtualizados: statsOrganistas[0].com_tenant
    };
    
  } catch (error) {
    console.error('❌ Erro na migração FASE 5:', error);
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
      await migrateFase5();
      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('Erro fatal:', error);
      process.exit(1);
    }
  })();
}

module.exports = migrateFase5;
