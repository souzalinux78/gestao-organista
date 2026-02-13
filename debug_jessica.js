const db = require('./server/database/db');
require('dotenv').config({ path: './.env' });

async function check() {
    try {
        await db.init();
        const pool = db.getDb();

        console.log('=== JESSICA CYCLE MEMBERSHIP ===');
        const [cycles] = await pool.execute(`
      SELECT ci.ciclo_id, c.nome as ciclo_nome, c.ordem, o.nome as organista
      FROM ciclo_itens ci
      JOIN ciclos c ON ci.ciclo_id = c.id
      JOIN organistas o ON ci.organista_id = o.id
      WHERE ci.igreja_id = 5 AND o.nome LIKE '%Jessica%'
    `);
        console.table(cycles);

        console.log('\n=== JESSICA RECENT RODIZIOS ===');
        const [rodizios] = await pool.execute(`
      SELECT r.id, r.data_culto, r.hora_culto, r.funcao, r.ciclo_origem,
             o.nome as organista, c.nome as ciclo_nome, k.tipo as culto_tipo,
             k.dia_semana, k.hora as culto_hora
      FROM rodizios r
      JOIN organistas o ON r.organista_id = o.id
      LEFT JOIN ciclos c ON r.ciclo_origem = c.id
      LEFT JOIN cultos k ON r.culto_id = k.id
      WHERE r.igreja_id = 5 AND o.nome LIKE '%Jessica%'
      ORDER BY r.data_culto DESC
      LIMIT 10
    `);
        console.table(rodizios);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

check();
