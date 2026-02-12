const db = require('./server/database/db');
const migrateStrictRules = require('./server/database/migrations/strict_rules');

async function run() {
    try {
        console.log('Iniciando DB...');
        await db.init();
        console.log('DB Inicializado. executando migração...');
        await migrateStrictRules();
        console.log('Sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('Erro fatal:', err);
        process.exit(1);
    }
}

run();
