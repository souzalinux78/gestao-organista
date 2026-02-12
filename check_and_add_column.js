const db = require('./server/database/db');

async function run() {
    try {
        console.log('Iniciando DB...');
        await db.init();
        const pool = db.getDb();

        console.log('Checking rodizios.ciclo_origem...');
        const [cols] = await pool.execute(`SHOW COLUMNS FROM rodizios LIKE 'ciclo_origem'`);

        if (cols.length === 0) {
            console.log('Adding ciclo_origem column...');
            await pool.execute(`
        ALTER TABLE rodizios
        ADD COLUMN ciclo_origem INT NULL AFTER periodo_fim
      `);
            console.log('Added ciclo_origem column.');
        } else {
            console.log('Column ciclo_origem already exists.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Erro:', err);
        process.exit(1);
    }
}

run();
