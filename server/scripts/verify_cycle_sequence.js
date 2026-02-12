const db = require('../database/db');
const rodizioCicloService = require('../services/rodizioCicloService');

async function testControlledSequence() {
    await db.init();
    const pool = db.getDb();
    const igrejaId = 1;

    console.log('🧪 Iniciando teste CONTROLADO de Sequenciamento de Ciclos...');

    // 1. Setup Test Environment
    await pool.execute('DELETE FROM rodizios WHERE igreja_id = ?', [igrejaId]);
    await pool.execute('DELETE FROM ciclo_itens WHERE igreja_id = ?', [igrejaId]);
    await pool.execute('DELETE FROM cultos WHERE igreja_id = ?', [igrejaId]);
    await pool.execute('DELETE FROM ciclos WHERE igreja_id = ?', [igrejaId]);

    const [orgs] = await pool.execute('SELECT id FROM organistas WHERE categoria = "oficial" LIMIT 6');
    const oA1 = orgs[0].id;
    const oA2 = orgs[1].id;
    const oB1 = orgs[2].id;
    const oB2 = orgs[3].id;
    const oR1 = orgs[4].id;
    const oR2 = orgs[5].id;

    // INSERT CYCLES
    const [c1] = await pool.execute('INSERT INTO ciclos (igreja_id, nome, ordem, ativo) VALUES (?, "Ciclo A", 1, 1)', [igrejaId]);
    const [c2] = await pool.execute('INSERT INTO ciclos (igreja_id, nome, ordem, ativo) VALUES (?, "Ciclo B", 2, 1)', [igrejaId]);
    const cicloA = c1.insertId;
    const cicloB = c2.insertId;

    const [c3] = await pool.execute('INSERT INTO ciclos (igreja_id, nome, ordem, ativo) VALUES (?, "Ciclo RJM", 3, 1)', [igrejaId]);
    const cicloRJM = c3.insertId;

    // INSERT ITEMS (2 per cycle)
    await pool.execute('INSERT INTO ciclo_itens (igreja_id, ciclo_id, organista_id, posicao, numero_ciclo) VALUES (?, ?, ?, 1, 1)', [igrejaId, cicloA, oA1]);
    await pool.execute('INSERT INTO ciclo_itens (igreja_id, ciclo_id, organista_id, posicao, numero_ciclo) VALUES (?, ?, ?, 2, 1)', [igrejaId, cicloA, oA2]);

    await pool.execute('INSERT INTO ciclo_itens (igreja_id, ciclo_id, organista_id, posicao, numero_ciclo) VALUES (?, ?, ?, 1, 2)', [igrejaId, cicloB, oB1]);
    await pool.execute('INSERT INTO ciclo_itens (igreja_id, ciclo_id, organista_id, posicao, numero_ciclo) VALUES (?, ?, ?, 2, 2)', [igrejaId, cicloB, oB2]);

    await pool.execute('INSERT INTO ciclo_itens (igreja_id, ciclo_id, organista_id, posicao, numero_ciclo) VALUES (?, ?, ?, 1, 3)', [igrejaId, cicloRJM, oR1]);
    await pool.execute('INSERT INTO ciclo_itens (igreja_id, ciclo_id, organista_id, posicao, numero_ciclo) VALUES (?, ?, ?, 2, 3)', [igrejaId, cicloRJM, oR2]);

    // INSERT CULTOS
    await pool.execute('INSERT INTO cultos (igreja_id, dia_semana, hora, tipo, ciclo_id, ativo) VALUES (?, "Segunda", "19:30:00", "culto_oficial", ?, 1)', [igrejaId, cicloA]);
    await pool.execute('INSERT INTO cultos (igreja_id, dia_semana, hora, tipo, ciclo_id, ativo) VALUES (?, "Quarta", "19:30:00", "culto_oficial", ?, 1)', [igrejaId, cicloB]);
    await pool.execute('INSERT INTO cultos (igreja_id, dia_semana, hora, tipo, ciclo_id, ativo) VALUES (?, "Domingo", "10:00:00", "rjm", ?, 1)', [igrejaId, cicloRJM]);

    // 2. Generate
    console.log('Generating rotation...');
    const startData = '2027-01-01'; // Friday
    const resultado = await rodizioCicloService.gerarRodizioComCiclos(igrejaId, 1, null, startData, null);

    // 3. Audit
    console.log('\n--- Auditoria do Rodízio Gerado ---');
    resultado.forEach(r => {
        // Use ciclo_origem for auditing as that's what repository returns
        console.log(`[${r.data_culto}] ${r.culto_tipo} - CicloID: ${r.ciclo_origem} - Org: ${r.organista_nome}`);
    });

    const officialEntries = resultado.filter(r => r.culto_tipo === 'culto_oficial');
    const rjmEntries = resultado.filter(r => r.culto_tipo === 'rjm');

    let seqOk = true;
    for (let i = 0; i < officialEntries.length - 2; i += 2) {
        const current = officialEntries[i];
        const next = officialEntries[i + 2];
        if (next && current.ciclo_origem === next.ciclo_origem) {
            console.log(`❌ FAIL: Sequential Official services used the same cycle: ${current.ciclo_origem}. Expected traversal.`);
            seqOk = false;
        }
    }

    const rjmCycleIssues = rjmEntries.filter(r => r.ciclo_origem !== cicloRJM);
    if (rjmCycleIssues.length > 0) {
        console.log('❌ FAIL: RJM service used non-RJM cycle!');
        seqOk = false;
    } else {
        console.log('✅ RJM isolation verified.');
    }

    if (seqOk) {
        const uniqueOfficialCycles = [...new Set(officialEntries.map(e => e.ciclo_origem))];
        if (uniqueOfficialCycles.length >= 2) {
            console.log('✅ Cycle traversal verified (span multiple Official cycles).');
        } else {
            console.log('❌ FAIL: Only one Official cycle was used.');
            seqOk = false;
        }
    }

    if (seqOk) console.log('✅ Cycle traversal and sequencing verified!');

    await db.close();
}

testControlledSequence().catch(err => {
    console.error(err);
    process.exit(1);
});
