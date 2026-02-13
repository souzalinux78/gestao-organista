const db = require('./server/database/db');
const fs = require('fs');
require('dotenv').config({ path: './.env' });

async function targetedCheck() {
    try {
        await db.init();
        const pool = db.getDb();

        const output = {};

        // 1. Check specific Sunday 10:00 RJM rodizios (as mentioned by user)
        const [sundayRJM] = await pool.execute(`
      SELECT r.id, r.data_culto, r.hora_culto, r.ciclo_origem,
             o.nome as organista, c.nome as ciclo_nome,
             k.tipo, k.dia_semana, k.hora
      FROM rodizios r
      JOIN organistas o ON r.organista_id = o.id
      LEFT JOIN ciclos c ON r.ciclo_origem = c.id
      JOIN cultos k ON r.culto_id = k.id
      WHERE r.igreja_id = 5 
        AND k.dia_semana = 'domingo' 
        AND k.hora = '10:00:00'
        AND (k.tipo = 'rjm' OR k.eh_rjm = 1)
        AND r.data_culto >= '2026-04-01'
      ORDER BY r.data_culto ASC
      LIMIT 10
    `);
        output.sunday_10am_rjm = sundayRJM;

        // 2. Check ALL Jessica entries
        const [jessicaAll] = await pool.execute(`
      SELECT r.id, r.data_culto, r.hora_culto, r.ciclo_origem,
             o.nome as organista, c.nome as ciclo_nome,
             k.tipo as culto_tipo, k.dia_semana
      FROM rodizios r
      JOIN organistas o ON r.organista_id = o.id
      LEFT JOIN ciclos c ON r.ciclo_origem = c.id
      JOIN cultos k ON r.culto_id = k.id
      WHERE r.igreja_id = 5 
        AND o.nome LIKE '%Jéssica%'
        AND r.data_culto >= '2026-04-01'
      ORDER BY r.data_culto ASC
    `);
        output.jessica_all_services = jessicaAll;

        // 3. Check cycle configuration
        const [cycles] = await pool.execute(`
      SELECT id, nome, ordem FROM ciclos WHERE igreja_id = 5 AND ativo = 1 ORDER BY ordem
    `);
        output.cycles = cycles;

        // 4. Check which cycle Jessica is in
        const [jessicaCycle] = await pool.execute(`
      SELECT ci.ciclo_id, c.nome as ciclo_nome, o.nome
      FROM ciclo_itens ci
      JOIN ciclos c ON ci.ciclo_id = c.id
      JOIN organistas o ON ci.organista_id = o.id
      WHERE ci.igreja_id = 5 AND o.nome LIKE '%Jéssica%'
    `);
        output.jessica_cycles = jessicaCycle;

        fs.writeFileSync('diagnosis_result.json', JSON.stringify(output, null, 2));
        console.log('Results written to diagnosis_result.json');
        console.log('\nKey Findings:');
        console.log(`- Sunday 10:00 RJM entries: ${sundayRJM.length}`);
        console.log(`- Jessica entries (all): ${jessicaAll.length}`);
        console.log(`- Jessica in cycles: ${jessicaCycle.map(c => c.ciclo_nome).join(', ')}`);

        if (sundayRJM.length > 0) {
            console.log('\nSunday 10:00 RJM Sample:');
            console.table(sundayRJM.slice(0, 3));
        }

        if (jessicaAll.length > 0) {
            console.log('\nJessica Services:');
            console.table(jessicaAll.slice(0, 5));
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

targetedCheck();
