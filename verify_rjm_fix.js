const db = require('./server/database/db');
require('dotenv').config({ path: './.env' });

async function verify() {
    try {
        await db.init();
        const pool = db.getDb();

        console.log('=== VERIFICATION 1: RJM RODIZIOS CYCLE DISPLAY ===');
        const [rjmRodizios] = await pool.execute(`
      SELECT r.data_culto, r.hora_culto, r.funcao, r.ciclo_origem,
             o.nome as organista, c.nome as ciclo_nome,
             k.dia_semana, k.hora as culto_hora
      FROM rodizios r
      JOIN organistas o ON r.organista_id = o.id
      LEFT JOIN ciclos c ON r.ciclo_origem = c.id
      JOIN cultos k ON r.culto_id = k.id
      WHERE r.igreja_id = 5 
        AND (k.tipo = 'rjm' OR k.eh_rjm = 1)
      ORDER BY r.data_culto ASC
      LIMIT 10
    `);
        console.table(rjmRodizios);

        console.log('\n=== VERIFICATION 2: JESSICA IN RJM SERVICES? ===');
        const [jessicaRJM] = await pool.execute(`
      SELECT r.data_culto, r.hora_culto, r.funcao,
             o.nome as organista, c.nome as ciclo_nome,
             k.tipo as culto_tipo
      FROM rodizios r
      JOIN organistas o ON r.organista_id = o.id
      LEFT JOIN ciclos c ON r.ciclo_origem = c.id
      JOIN cultos k ON r.culto_id = k.id
      WHERE r.igreja_id = 5 
        AND o.nome LIKE '%Jessica%'
        AND (k.tipo = 'rjm' OR k.eh_rjm = 1)
    `);

        if (jessicaRJM.length === 0) {
            console.log('✓ SUCCESS: Jessica is NOT in any RJM services');
        } else {
            console.log('✗ ERROR: Jessica found in RJM services:');
            console.table(jessicaRJM);
        }

        console.log('\n=== VERIFICATION 3: RJM ORGANISTS SUMMARY ===');
        const [rjmOrganists] = await pool.execute(`
      SELECT DISTINCT o.nome as organista, c.nome as ciclo_nome
      FROM rodizios r
      JOIN organistas o ON r.organista_id = o.id
      LEFT JOIN ciclos c ON r.ciclo_origem = c.id
      JOIN cultos k ON r.culto_id = k.id
      WHERE r.igreja_id = 5 
        AND (k.tipo = 'rjm' OR k.eh_rjm = 1)
      ORDER BY o.nome
    `);
        console.table(rjmOrganists);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

verify();
