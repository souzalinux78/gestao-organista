const db = require('./server/database/db');
require('dotenv').config({ path: './.env' });

async function deepDiagnosis() {
    try {
        await db.init();
        const pool = db.getDb();

        console.log('=== 1. CHECKING ACTUAL CICLO_ORIGEM VALUES ===');
        const [rjmRodizios] = await pool.execute(`
      SELECT r.id, r.data_culto, r.hora_culto, r.ciclo_origem,
             o.nome as organista, c.nome as ciclo_nome, c.id as ciclo_id,
             k.tipo as culto_tipo, k.dia_semana
      FROM rodizios r
      JOIN organistas o ON r.organista_id = o.id
      LEFT JOIN ciclos c ON r.ciclo_origem = c.id
      JOIN cultos k ON r.culto_id = k.id
      WHERE r.igreja_id = 5 
        AND (k.tipo = 'rjm' OR k.eh_rjm = 1)
        AND r.data_culto >= '2026-04-01'
      ORDER BY r.data_culto ASC
      LIMIT 15
    `);
        console.log(`Found ${rjmRodizios.length} RJM rodizios from April 2026 onwards`);
        console.table(rjmRodizios);

        console.log('\n=== 2. CHECKING IF JESSICA IS IN RJM RODIZIOS ===');
        const [jessicaRJM] = await pool.execute(`
      SELECT r.id, r.data_culto, r.hora_culto, r.ciclo_origem,
             o.id as organista_id, o.nome as organista,
             c.nome as ciclo_nome, k.tipo as culto_tipo
      FROM rodizios r
      JOIN organistas o ON r.organista_id = o.id
      LEFT JOIN ciclos c ON r.ciclo_origem = c.id
      JOIN cultos k ON r.culto_id = k.id
      WHERE r.igreja_id = 5 
        AND o.nome LIKE '%Jessica%'
        AND (k.tipo = 'rjm' OR k.eh_rjm = 1)
        AND r.data_culto >= '2026-04-01'
    `);
        console.log(`Found ${jessicaRJM.length} RJM entries for Jessica from April onwards`);
        if (jessicaRJM.length > 0) {
            console.table(jessicaRJM);
        }

        console.log('\n=== 3. CHECKING CYCLE CONFIGURATION ===');
        const [cycles] = await pool.execute(`
      SELECT c.id, c.nome, c.ordem,
        (SELECT COUNT(*) FROM cultos k WHERE k.ciclo_id = c.id AND k.tipo = 'culto_oficial') as official_links,
        (SELECT COUNT(*) FROM cultos k WHERE k.ciclo_id = c.id AND (k.tipo = 'rjm' OR k.eh_rjm = 1)) as rjm_links
      FROM ciclos c 
      WHERE c.igreja_id = 5 AND c.ativo = 1
      ORDER BY c.ordem
    `);
        console.table(cycles);

        console.log('\n=== 4. CHECKING JESSICA CYCLE MEMBERSHIP ===');
        const [jessicaCycles] = await pool.execute(`
      SELECT ci.ciclo_id, c.nome as ciclo_nome, c.ordem, o.nome as organista
      FROM ciclo_itens ci
      JOIN ciclos c ON ci.ciclo_id = c.id
      JOIN organistas o ON ci.organista_id = o.id
      WHERE ci.igreja_id = 5 AND o.nome LIKE '%Jessica%'
    `);
        console.table(jessicaCycles);

        console.log('\n=== 5. SUMMARY ===');
        console.log('Expected behavior:');
        console.log('  - RJM rodizios should have ciclo_origem = 8 (RJM cycle)');
        console.log('  - RJM rodizios should show ciclo_nome = "RJM"');
        console.log('  - Jessica should NOT appear in any RJM rodizios');
        console.log('  - Jessica is in cycle(s):', jessicaCycles.map(c => c.ciclo_nome).join(', '));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

deepDiagnosis();
