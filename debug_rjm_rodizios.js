const db = require('./server/database/db');
require('dotenv').config({ path: './.env' });

async function check() {
    try {
        await db.init();
        const pool = db.getDb();

        console.log('=== RJM RODIZIOS WITH CYCLE INFO ===');
        const [rodizios] = await pool.execute(`
      SELECT r.id, r.data_culto, r.hora_culto, r.funcao, r.ciclo_origem,
             o.nome as organista, c.nome as ciclo_nome,
             k.tipo as culto_tipo, k.dia_semana, k.hora as culto_hora
      FROM rodizios r
      JOIN organistas o ON r.organista_id = o.id
      LEFT JOIN ciclos c ON r.ciclo_origem = c.id
      JOIN cultos k ON r.culto_id = k.id
      WHERE r.igreja_id = 5 
        AND (k.tipo = 'rjm' OR k.eh_rjm = 1)
      ORDER BY r.data_culto DESC
      LIMIT 10
    `);
        console.table(rodizios);

        console.log('\n=== CYCLE SUMMARY ===');
        const [cycles] = await pool.execute(`
      SELECT id, nome, ordem FROM ciclos WHERE igreja_id = 5 AND ativo = 1 ORDER BY ordem
    `);
        console.table(cycles);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

check();
