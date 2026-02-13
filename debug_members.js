const db = require('./server/database/db');
const fs = require('fs');
require('dotenv').config({ path: './.env' });

async function check() {
    try {
        await db.init();
        const pool = db.getDb();

        const cycles = [7, 8];
        const results = {};

        for (const cid of cycles) {
            const [items] = await pool.execute(`
            SELECT ci.posicao, ci.organista_id, o.nome, o.categoria 
            FROM ciclo_itens ci 
            JOIN organistas o ON ci.organista_id = o.id 
            WHERE ci.ciclo_id = ? 
            ORDER BY ci.posicao
        `, [cid]);
            results[cid] = items;
        }

        fs.writeFileSync('members.json', JSON.stringify(results, null, 2), 'utf8');

        // Also print to console
        console.log(JSON.stringify(results, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

check();
