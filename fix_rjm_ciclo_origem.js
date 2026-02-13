const db = require('./server/database/db');
require('dotenv').config({ path: './.env' });

async function fix() {
    try {
        await db.init();
        const pool = db.getDb();

        console.log('=== FIXING RJM RODIZIOS CICLO_ORIGEM ===');

        // Update all RJM rodizios to point to Cycle 8 (RJM)
        const [result] = await pool.execute(`
      UPDATE rodizios r
      JOIN cultos k ON r.culto_id = k.id
      SET r.ciclo_origem = 8
      WHERE r.igreja_id = 5 
        AND (k.tipo = 'rjm' OR k.eh_rjm = 1)
        AND r.ciclo_origem != 8
    `);

        console.log(`Updated ${result.changedRows} rodizios to use Cycle 8 (RJM)`);

        // Verify
        console.log('\n=== VERIFICATION: RJM RODIZIOS AFTER FIX ===');
        const [rodizios] = await pool.execute(`
      SELECT r.id, r.data_culto, r.hora_culto, r.ciclo_origem,
             o.nome as organista, c.nome as ciclo_nome,
             k.tipo as culto_tipo
      FROM rodizios r
      JOIN organistas o ON r.organista_id = o.id
      LEFT JOIN ciclos c ON r.ciclo_origem = c.id
      JOIN cultos k ON r.culto_id = k.id
      WHERE r.igreja_id = 5 
        AND (k.tipo = 'rjm' OR k.eh_rjm = 1)
      ORDER BY r.data_culto DESC
      LIMIT 5
    `);
        console.table(rodizios);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

fix();
