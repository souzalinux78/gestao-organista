const db = require('../database/db');

const fixTenantDefaults = async () => {
    try {
        await db.init();
        const pool = db.getDb();
        console.log('🚀 Ajustando Defaults de Tenant no Banco de Dados...');

        // 1. Obter tenant padrão
        let [tenants] = await pool.execute('SELECT id FROM tenants WHERE slug = ?', ['default']);
        let defaultTenantId;

        if (tenants.length === 0) {
            console.log('⚠️ Tenant padrão não encontrado. Criando...');
            await pool.execute('INSERT INTO tenants (nome, slug, ativo) VALUES (?, ?, ?)', ['Tenant Padrão', 'default', 1]);
            const [res] = await pool.execute('SELECT LAST_INSERT_ID() as id');
            defaultTenantId = res[0].id;
        } else {
            defaultTenantId = tenants[0].id;
        }

        console.log(`✅ Tenant Padrão ID: ${defaultTenantId}`);

        // 2. Alterar tabelas para ter DEFAULT
        const tables = ['organistas', 'igrejas', 'usuarios'];

        for (const table of tables) {
            try {
                // Verificar se a coluna existe
                const [cols] = await pool.execute(`SHOW COLUMNS FROM ${table} LIKE 'tenant_id'`);
                if (cols.length > 0) {
                    console.log(`🔧 Ajustando tabela ${table}...`);
                    // Alterar coluna para ter default (MySQL)
                    // DDL não suporta placeholder '?' em muitos drivers/versões para valores DEFAULT
                    await pool.execute(`ALTER TABLE ${table} ALTER COLUMN tenant_id SET DEFAULT ${defaultTenantId}`);
                    console.log(`✅ Tabela ${table} ajustada com DEFAULT ${defaultTenantId}`);
                } else {
                    console.log(`ℹ️ Tabela ${table} não tem coluna tenant_id.`);
                }
            } catch (err) {
                console.error(`❌ Erro ao ajustar tabela ${table}:`, err.message);
            }
        }

        console.log('🏁 Ajustes concluídos!');

    } catch (error) {
        console.error('Erro fatal:', error);
    } finally {
        await db.close();
    }
};

if (require.main === module) {
    fixTenantDefaults();
}

module.exports = fixTenantDefaults;
