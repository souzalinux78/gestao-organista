
const db = require('./server/database/db');
const fs = require('fs');
require('dotenv').config({ path: './.env' });

async function check() {
    try {
        await db.init();
        const pool = db.getDb();

        // 1. Get Cycles with Link Counts
        const [cycles] = await pool.execute(`
      SELECT c.id, c.nome, c.ordem,
        (SELECT COUNT(*) FROM cultos k WHERE k.ciclo_id = c.id AND k.tipo = 'culto_oficial') as official_links,
        (SELECT COUNT(*) FROM cultos k WHERE k.ciclo_id = c.id AND k.tipo = 'rjm') as rjm_links
      FROM ciclos c 
      WHERE c.igreja_id = 5
    `);

        // 2. Get recent Rodizios to see "Ciclo 2" usage
        const [rodizios] = await pool.execute(`
      SELECT r.id, r.data_culto, r.ciclo_origem, c.nome as ciclo_nome,
             k.tipo as culto_tipo, k.dia_semana, k.hora
      FROM rodizios r
      LEFT JOIN ciclos c ON r.ciclo_origem = c.id
      LEFT JOIN cultos k ON r.culto_id = k.id
      WHERE r.igreja_id = 5
      ORDER BY r.data_culto DESC
      LIMIT 10
    `);

        const output = {
            cycles,
            rodizios
        };

        fs.writeFileSync('cycles.json', JSON.stringify(output, null, 2));
        console.log('Data written to cycles.json');

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

check();
