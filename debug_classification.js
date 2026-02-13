
const db = require('./server/database/db');
const fs = require('fs');
require('dotenv').config({ path: './.env' });

async function check() {
    const logBuffer = [];
    const log = (msg) => {
        console.log(msg);
        logBuffer.push(typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg);
    };

    try {
        await db.init();
        const pool = db.getDb();

        // 1. Find based on known ID from previous debug
        const [silvias] = await pool.execute("SELECT o.id, o.nome, oi.igreja_id FROM organistas o JOIN organistas_igreja oi ON o.id = oi.organista_id WHERE o.id = 27 LIMIT 1");

        if (silvias.length === 0) {
            log("Organist not found.");
            return;
        }
        const churchId = silvias[0].igreja_id;
        log(`Church ID: ${churchId}`);

        // 2. Inspcet Cultos
        log('\n--- CULTOS ---');
        const [cultos] = await pool.execute('SELECT id, dia_semana, hora, tipo, eh_rjm, ciclo_id FROM cultos WHERE igreja_id = ? AND ativo = 1', [churchId]);
        log(cultos);

        // 3. Inspect Cycles and Classification Logic
        log('\n--- CICLOS & CLASSIFICATION ---');
        const [ciclos] = await pool.execute('SELECT * FROM ciclos WHERE igreja_id = ? AND ativo = 1 ORDER BY ordem ASC', [churchId]);

        for (const c of ciclos) {
            const isLinkedToOfficial = cultos.some(culto => culto.ciclo_id === c.id && culto.tipo === 'culto_oficial');
            const isLinkedToRJM = cultos.some(culto => culto.ciclo_id === c.id && (culto.tipo === 'rjm' || culto.eh_rjm === 1));

            let type = 'both (default)';
            if (isLinkedToOfficial && isLinkedToRJM) type = 'both (explicit)';
            else if (isLinkedToRJM) type = 'rjm';
            else if (isLinkedToOfficial) type = 'official';

            // Check name heuristic
            const nameIsRJM = c.nome.toLowerCase().includes('rjm');

            const info = {
                id: c.id,
                nome: c.nome,
                linkedOfficial: isLinkedToOfficial,
                linkedRJM: isLinkedToRJM,
                DETECTED_TYPE: type,
                NameSaysRJM: nameIsRJM
            };
            log(info);
        }

        fs.writeFileSync('final_classification.json', JSON.stringify(logBuffer, null, 2), 'utf8');

        // Chunked output to console for reading
        const jsonStr = JSON.stringify(logBuffer, null, 2);
        const chunkSize = 1000;
        for (let i = 0; i < jsonStr.length; i += chunkSize) {
            console.log(jsonStr.substring(i, i + chunkSize));
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

check();
