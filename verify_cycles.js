const { gerarRodizioComCiclos } = require('./server/services/rodizioCicloService');
const db = require('./server/database/db');
require('dotenv').config();

const verifyCycles = async () => {
    try {
        await db.init();
        const pool = db.getDb();
        console.log('🚀 Verificando Lógica de Ciclos com Cultos Associados...');

        // 0. FETCH TENANT
        const [tenants] = await pool.execute('SELECT id FROM tenants WHERE slug = ?', ['default']);
        let tenantId = 1; // Default fallback
        if (tenants.length > 0) {
            tenantId = tenants[0].id;
        } else {
            // Create if not exists (Should exist, but for safety in test env)
            await pool.execute('INSERT INTO tenants (nome, slug, ativo) VALUES (?, ?, ?)', ['Test Tenant', 'default', 1]);
            const [newT] = await pool.execute('SELECT LAST_INSERT_ID() as id');
            tenantId = newT[0].id;
        }
        console.log('Using Tenant ID:', tenantId);

        // 1. SETUP: Create Dummy Data (Igreja, Cultos, Organistas, Ciclos)
        // We will use a dedicated test church to avoid messing with real data if possible,
        // or just clean up after. Let's use ID 999 (if not exists)

        // Clean up first
        const testIgrejaId = 999;
        await pool.execute('DELETE FROM igrejas WHERE id = ?', [testIgrejaId]);

        // Create Church
        await pool.execute('INSERT INTO igrejas (id, nome, tenant_id) VALUES (?, ?, ?)', [testIgrejaId, 'Teste Ciclos', tenantId]);

        // Create Cultos
        // Culto A: Oficial (Domingo 10:00)
        // Culto B: RJM (Domingo 14:00)
        await pool.execute(`INSERT INTO cultos (igreja_id, dia_semana, hora, tipo) VALUES (?, 'domingo', '10:00:00', 'culto_oficial')`, [testIgrejaId]);
        const [resCA] = await pool.execute('SELECT LAST_INSERT_ID() as id');
        const cultoAId = resCA[0].id;

        await pool.execute(`INSERT INTO cultos (igreja_id, dia_semana, hora, tipo) VALUES (?, 'domingo', '14:00:00', 'rjm')`, [testIgrejaId]);
        const [resCB] = await pool.execute('SELECT LAST_INSERT_ID() as id');
        const cultoBId = resCB[0].id;

        // Create Ciclos
        // Ciclo 1: "Ciclo Oficial"
        // Ciclo 2: "Ciclo RJM"
        await pool.execute(`INSERT INTO ciclos (igreja_id, nome, ordem, ativo) VALUES (?, 'Ciclo Oficial', 1, 1)`, [testIgrejaId]);
        const [resC1] = await pool.execute('SELECT LAST_INSERT_ID() as id');
        const ciclo1Id = resC1[0].id;

        await pool.execute(`INSERT INTO ciclos (igreja_id, nome, ordem, ativo) VALUES (?, 'Ciclo RJM', 2, 1)`, [testIgrejaId]);
        const [resC2] = await pool.execute('SELECT LAST_INSERT_ID() as id');
        const ciclo2Id = resC2[0].id;

        // ASSOCIATE Cultos -> Ciclos
        // Culto A (Oficial) -> Ciclo 1
        // Culto B (RJM) -> Ciclo 2
        await pool.execute('UPDATE cultos SET ciclo_id = ? WHERE id = ?', [ciclo1Id, cultoAId]);
        await pool.execute('UPDATE cultos SET ciclo_id = ? WHERE id = ?', [ciclo2Id, cultoBId]);

        // Create Organistas
        // Org 1 (Oficial) -> Ciclo 1
        // Org 2 (Oficial) -> Ciclo 1
        // Org 3 (RJM) -> Ciclo 2

        const createOrg = async (nome, cat, cicloId, pos) => {
            // Email is required or similar? Check schema earlier. Table definition says email varchar(255).
            // Let's provide dummy email.
            const email = `dummy_${Date.now()}_${Math.random()}@test.com`;
            await pool.execute('INSERT INTO organistas (nome, email, categoria, ativa, oficializada, tenant_id) VALUES (?, ?, ?, 1, 1, ?)', [nome, email, cat, tenantId]);
            const [r] = await pool.execute('SELECT LAST_INSERT_ID() as id');
            const oid = r[0].id;
            await pool.execute('INSERT INTO ciclo_itens (igreja_id, numero_ciclo, organista_id, posicao, ciclo_id) VALUES (?, 1, ?, ?, ?)', [testIgrejaId, oid, pos, cicloId]);
            return oid;
        };

        const org1 = await createOrg('Org Oficial 1', 'oficial', ciclo1Id, 1);
        const org2 = await createOrg('Org Oficial 2', 'oficial', ciclo1Id, 2);
        const org3 = await createOrg('Org RJM 1', 'rjm', ciclo2Id, 1);

        // 2. RUN GENERATION
        const hoje = new Date().toISOString().split('T')[0];
        const resultado = await gerarRodizioComCiclos(testIgrejaId, 1, null, hoje, null);

        // 3. ASSERTIONS
        console.log(`Gerado ${resultado.length} registros.`);

        // Filter by Culto
        const rCultoA = resultado.filter(r => r.culto_id === cultoAId);
        const rCultoB = resultado.filter(r => r.culto_id === cultoBId);

        console.log(`Culto A (Oficial/Ciclo 1) tem ${rCultoA.length} escalas.`);
        console.log(`Culto B (RJM/Ciclo 2) tem ${rCultoB.length} escalas.`);

        // Check if Culto A only used Org 1 and Org 2 (From Ciclo 1)
        const usersA = [...new Set(rCultoA.map(r => r.organista_id))];
        const fromCiclo1 = [org1, org2];
        const isAValid = usersA.every(u => fromCiclo1.includes(u));

        // Check if Culto B only used Org 3 (From Ciclo 2)
        const usersB = [...new Set(rCultoB.map(r => r.organista_id))];
        const fromCiclo2 = [org3];
        const isBValid = usersB.every(u => fromCiclo2.includes(u));

        if (isAValid && isBValid) {
            console.log('✅ SUCESSO! A separação por ciclos funcionou perfeitamente.');
        } else {
            console.error('❌ FALHA! Mistura de ciclos detectada.');
            console.log('Users A (Expected 1,2):', usersA);
            console.log('Users B (Expected 3):', usersB);
        }

        // CLEANUP
        console.log('🧹 Limpando dados de teste...');
        // await pool.execute('DELETE FROM igrejas WHERE id = ?', [testIgrejaId]);
        await pool.execute('DELETE FROM organistas WHERE id IN (?, ?, ?)', [org1, org2, org3]);

    } catch (error) {
        const errorLog = `
❌ ERRO DETALHADO: ${error.sqlMessage || error.message}
CODE: ${error.code}
SQL: ${error.sql}
STACK: ${error.stack}
        `;
        console.error(errorLog);
        require('fs').writeFileSync('verify_error.log', errorLog);
    } finally {
        await db.close();
    }
};

verifyCycles();
