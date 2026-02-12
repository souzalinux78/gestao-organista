const db = require('../database/db');
const rodizioCicloService = require('../services/rodizioCicloService');

async function testRotation() {
    try {
        await db.init();
        const pool = db.getDb();

        const igrejaId = 1;
        const periodo = 4; // 4 meses para garantir alcance
        const dataInicial = '2026-03-01';

        console.log('🧪 Iniciando teste de Rodízio Avançado...');

        // 1. Limpar rodízios futuros para não poluir
        await pool.execute('DELETE FROM rodizios WHERE igreja_id = ? AND data_culto >= ?', [igrejaId, dataInicial]);

        // 2. Chamar o serviço
        const resultado = await rodizioCicloService.gerarRodizioComCiclos(igrejaId, periodo, null, dataInicial, null);

        console.log(`✅ Rodízio gerado. Total de registros: ${resultado.length}`);

        const officialSequence = resultado
            .filter(r => r.culto_tipo === 'culto_oficial')
            .map(r => ({
                data: r.data_culto,
                nome: r.organista_nome,
                cat: r.organista_categoria,
                funcao: r.funcao
            }));

        const fs = require('fs');
        fs.writeFileSync('test_rotation_result.json', JSON.stringify({
            total: resultado.length,
            officialSequence: officialSequence
        }, null, 2));
        console.log('Results written to test_rotation_result.json');

    } catch (e) {
        console.error('❌ Erro no teste:', e);
    } finally {
        await db.close();
    }
}

testRotation();
