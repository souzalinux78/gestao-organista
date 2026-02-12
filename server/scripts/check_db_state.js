const db = require('../database/db');

async function checkState() {
    try {
        await db.init();
        const pool = db.getDb();

        console.log('--- CICLOS ---');
        const [ciclos] = await pool.query('SELECT * FROM ciclos LIMIT 5');
        console.table(ciclos);

        if (ciclos.length > 0) {
            const cicloId = ciclos[0].id;
            console.log(`\n--- ITENS DO CICLO ${cicloId} ---`);
            const [itens] = await pool.query('SELECT * FROM ciclo_itens WHERE ciclo_id = ?', [cicloId]);
            console.log(JSON.stringify(itens, null, 2));
        } else {
            console.log('Nenhum ciclo encontrado.');
        }

        console.log('\n--- ORGANISTAS (Amostra) ---');
        const [orgs] = await pool.query('SELECT id, nome, oficializada, categoria FROM organistas LIMIT 5');
        console.log(JSON.stringify(orgs, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await db.close();
    }
}

checkState();
