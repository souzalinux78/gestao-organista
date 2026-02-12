
const db = require('./server/database/db');
const rodizioCicloService = require('./server/services/rodizioCicloService');
const repository = require('./server/services/rodizioRepository');
require('dotenv').config();

// Override db.getDb if needed, or rely on .env
// We need to initialize the pool
async function mockDbConnection() {
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'FLoc25GD!'; // Use temp password if not in env
    await db.init();
    console.log("DB Initialized");
}

async function runVerification() {
    try {
        await mockDbConnection();
        const pool = db.getDb();

        console.log("\n--- INICIANDO VERIFICAÇÃO ---");

        // 1. Setup Test Data
        console.log("1. Criando dados de teste...");
        // Igreja Teste
        const [igrejaRes] = await pool.execute("INSERT INTO igrejas (nome, tenant_id) VALUES ('Igreja Teste', 1)");
        const igrejaId = igrejaRes.insertId;
        console.log(`   Igreja criada: ID ${igrejaId}`);

        // Ciclos (Normal e RJM)
        const [cicloNormal] = await pool.execute("INSERT INTO ciclos (igreja_id, nome, ordem) VALUES (?, 'Ciclo Normal', 1)", [igrejaId]);
        const [cicloRJM] = await pool.execute("INSERT INTO ciclos (igreja_id, nome, ordem) VALUES (?, 'RJM', 2)", [igrejaId]);
        const idCicloNormal = cicloNormal.insertId;
        const idCicloRJM = cicloRJM.insertId;
        console.log(`   Ciclos criados: Normal (${idCicloNormal}), RJM (${idCicloRJM})`);

        // Cultos (Oficial e RJM)
        // Quinta - Oficial
        await pool.execute("INSERT INTO cultos (igreja_id, dia_semana, hora, tipo) VALUES (?, 'quinta', '19:30', 'culto_oficial')", [igrejaId]);
        // Domingo - RJM
        await pool.execute("INSERT INTO cultos (igreja_id, dia_semana, hora, tipo) VALUES (?, 'domingo', '14:00', 'rjm')", [igrejaId]);
        console.log("   Cultos criados.");

        // Organistas
        // Org1: Oficial (Normal Track)
        const [org1] = await pool.execute("INSERT INTO organistas (nome, categoria, oficializada, tenant_id) VALUES ('Org Oficial', 'oficial', 1, 1)");
        // Org2: RJM Only
        const [org2] = await pool.execute("INSERT INTO organistas (nome, categoria, oficializada, tenant_id) VALUES ('Org RJM', 'rjm', 0, 1)");
        // Org3: Aluna (Normal Track)
        const [org3] = await pool.execute("INSERT INTO organistas (nome, categoria, oficializada, tenant_id) VALUES ('Org Aluna', 'aluna', 0, 1)");

        const idOrgOficial = org1.insertId;
        const idOrgRJM = org2.insertId;
        const idOrgAluna = org3.insertId;

        // Associar e Adicionar aos Ciclos
        // Oficial -> Ciclo Normal
        await pool.execute("INSERT INTO organistas_igreja (organista_id, igreja_id, oficializada) VALUES (?,?,1)", [idOrgOficial, igrejaId]);
        await pool.execute("INSERT INTO ciclo_itens (igreja_id, ciclo_id, organista_id, posicao, numero_ciclo) VALUES (?,?,?,1,0)", [igrejaId, idCicloNormal, idOrgOficial]);

        // Aluna -> Ciclo Normal
        await pool.execute("INSERT INTO organistas_igreja (organista_id, igreja_id, oficializada) VALUES (?,?,0)", [idOrgAluna, igrejaId]);
        await pool.execute("INSERT INTO ciclo_itens (igreja_id, ciclo_id, organista_id, posicao, numero_ciclo) VALUES (?,?,?,2,0)", [igrejaId, idCicloNormal, idOrgAluna]);

        // RJM -> Ciclo RJM
        await pool.execute("INSERT INTO organistas_igreja (organista_id, igreja_id, oficializada) VALUES (?,?,0)", [idOrgRJM, igrejaId]);
        await pool.execute("INSERT INTO ciclo_itens (igreja_id, ciclo_id, organista_id, posicao, numero_ciclo) VALUES (?,?,?,1,0)", [igrejaId, idCicloRJM, idOrgRJM]);

        console.log("   Organistas associadas.");

        // 2. Run Generation
        console.log("2. Gerando Rodízio...");
        const resultado = await rodizioCicloService.gerarRodizioComCiclos(igrejaId, 1, null, '2024-01-01', null);

        // 3. Verify Results
        console.log("\n3. Verificando Resultados (JSON):", JSON.stringify(resultado, null, 2));

        // Check 1: RJM Service should have RJM organist
        const cultosRJM = resultado.filter(r => r.culto_tipo === 'rjm');
        const cultosOficial = resultado.filter(r => r.culto_tipo === 'culto_oficial');

        console.log(`\n   Cultos RJM gerados: ${cultosRJM.length}`);
        console.log(`   Cultos Oficiais gerados: ${cultosOficial.length}`);

        let passed = true;

        cultosRJM.forEach(r => {
            if (r.organista_nome !== 'Org RJM') {
                console.error(`ERROR: Culto RJM tem organista errada: ${r.organista_nome}`);
                passed = false;
            }
        });

        cultosOficial.forEach(r => {
            // Oficial or Aluna logic verification
            console.log(`   Culto Oficial (${r.data}): Meia Hora: ${r.organista_meia_hora_nome}, Culto: ${r.organista_culto_nome}`);
        });

        if (passed) console.log("\n✅ VERIFICAÇÃO BÁSICA APROVADA!");
        else console.error("\n❌ VERIFICAÇÃO FALHOU!");

        // CLEANUP
        console.log("\nCleaning up...");
        await pool.execute("DELETE FROM igrejas WHERE id = ?", [igrejaId]); // Cascades should handle the rest
        await pool.execute("DELETE FROM organistas WHERE id IN (?,?,?)", [idOrgOficial, idOrgRJM, idOrgAluna]);

    } catch (e) {
        console.error("ERRO CRÍTICO DETALHADO:");
        console.error(e.message);
        console.error(e.code);
        console.error(e.sqlMessage);
        console.error(e.sql);
        console.error(e.stack);
    } finally {
        process.exit();
    }
}

runVerification();
