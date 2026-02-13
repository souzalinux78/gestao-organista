const db = require('./server/database/db');
require('dotenv').config({ path: './.env' });

async function forceCleanup() {
    try {
        await db.init();
        const pool = db.getDb();

        console.log('=== FORÇA LIMPEZA COMPLETA - Igreja ID 5 ===\n');

        // 1. Deletar TODOS os rodízios da Igreja 5
        console.log('1. Deletando TODOS os rodízios da Igreja 5...');
        const [deleteResult] = await pool.execute(
            'DELETE FROM rodizios WHERE igreja_id = 5'
        );
        console.log(`   ✓ ${deleteResult.affectedRows} rodízios deletados\n`);

        // 2. Verificar se ainda há rodízios
        console.log('2. Verificando se ainda há rodízios...');
        const [remaining] = await pool.execute(
            'SELECT COUNT(*) as count FROM rodizios WHERE igreja_id = 5'
        );
        console.log(`   ${remaining[0].count === 0 ? '✓' : '✗'} Rodízios restantes: ${remaining[0].count}\n`);

        // 3. Mostrar configuração de ciclos
        console.log('3. Configuração de Ciclos:');
        const [cycles] = await pool.execute(`
      SELECT c.id, c.nome, c.ordem,
        (SELECT COUNT(*) FROM cultos k WHERE k.ciclo_id = c.id AND k.tipo = 'culto_oficial') as oficial_links,
        (SELECT COUNT(*) FROM cultos k WHERE k.ciclo_id = c.id AND (k.tipo = 'rjm' OR k.eh_rjm = 1)) as rjm_links,
        (SELECT COUNT(*) FROM ciclo_itens ci WHERE ci.ciclo_id = c.id) as organistas
      FROM ciclos c
      WHERE c.igreja_id = 5 AND c.ativo = 1
      ORDER BY c.ordem
    `);
        console.table(cycles);

        // 4. Mostrar cultos RJM
        console.log('\n4. Cultos RJM:');
        const [rjmCultos] = await pool.execute(`
      SELECT id, dia_semana, hora, tipo, eh_rjm, ciclo_id
      FROM cultos
      WHERE igreja_id = 5 AND (tipo = 'rjm' OR eh_rjm = 1)
    `);
        console.table(rjmCultos);

        console.log('\n=== PRÓXIMOS PASSOS ===');
        console.log('1. ❌ PARE O SERVIDOR (Ctrl+C no terminal npm run server)');
        console.log('2. ✅ INICIE O SERVIDOR (npm run server)');
        console.log('3. ✅ GERE NOVO RODÍZIO através da interface');
        console.log('\nApós reiniciar, o código do FILTRO ESTRITO RJM estará ativo!');

    } catch (e) {
        console.error('Erro:', e);
    } finally {
        process.exit();
    }
}

forceCleanup();
