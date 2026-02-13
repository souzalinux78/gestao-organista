
const db = require('./server/database/db');
require('dotenv').config({ path: './.env' });

async function fix() {
    try {
        await db.init();
        const pool = db.getDb();

        console.log('Updating Culto 12 to TYPE=RJM, EH_RJM=1, CICLO_ID=8...');

        // 1. Update
        const [result] = await pool.execute(`
      UPDATE cultos 
      SET tipo = 'rjm', eh_rjm = 1, ciclo_id = 8 
      WHERE id = 12
    `);

        console.log(`Updated rows: ${result.changedRows}`);

        // 2. Verify
        const [culto] = await pool.execute('SELECT * FROM cultos WHERE id = 12');
        console.table(culto);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

fix();
