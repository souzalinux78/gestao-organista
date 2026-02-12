const db = require('../database/db');
const cicloRepository = require('../services/cicloRepository');

async function testSave() {
    try {
        await db.init();
        const pool = db.getDb();

        // 1. Identificar uma igreja e um organista p/ teste
        const [igrejas] = await pool.query('SELECT id FROM igrejas LIMIT 1');
        if (igrejas.length === 0) throw new Error('Sem igrejas para teste');
        const igrejaId = igrejas[0].id;

        const [organistas] = await pool.query('SELECT id FROM organistas WHERE tenant_id IS NOT NULL OR tenant_id IS NULL LIMIT 1');
        if (organistas.length === 0) throw new Error('Sem organistas para teste');
        const organistaId = organistas[0].id; // Usando o primeiro encontrado

        console.log(`🧪 Testando com Igreja ID: ${igrejaId}, Organista ID: ${organistaId}`);

        // 2. Criar um Ciclo Dummy (se não houver)
        let cicloId = 1;
        const [ciclos] = await pool.query('SELECT id FROM ciclos WHERE igreja_id = ? LIMIT 1', [igrejaId]);
        if (ciclos.length > 0) {
            cicloId = ciclos[0].id;
        } else {
            const [res] = await pool.execute('INSERT INTO ciclos (igreja_id, nome, ordem, ativo) VALUES (?, ?, ?, ?)', [igrejaId, 'Ciclo Debug', 1, 1]);
            cicloId = res.insertId;
        }
        console.log(`🔄 Ciclo Alvo ID: ${cicloId}`);

        // 3. Tentar Salvar via Repository
        const itensSimulados = [
            { organista_id: organistaId, ordem: 1 }
        ];

        console.log('💾 Chamando cicloRepository.salvarCiclo()...');
        await cicloRepository.salvarCiclo(igrejaId, cicloId, itensSimulados);
        console.log('✅ cicloRepository.salvarCiclo() retornou sucesso.');

        // 4. Verificar Persistência
        console.log('🔍 Verificando tabela ciclo_itens...');
        const [rows] = await pool.query('SELECT * FROM ciclo_itens WHERE igreja_id = ? AND ciclo_id = ?', [igrejaId, cicloId]);
        console.log('📋 Linhas encontradas:', rows);

        if (rows.length === 2) {
            console.log('✅ TESTE PASSOU: Dados persistidos corretamente.');
        } else {
            console.error(`❌ TESTE FALHOU: Esperado 2 registros, encontrado ${rows.length}.`);
        }

    } catch (e) {
        console.error('❌ ERRO NO TESTE:', e);
    } finally {
        await db.close();
    }
}

testSave();
