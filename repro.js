const db = require('../server/database/db');
const { gerarRodizioComCiclos } = require('../server/services/rodizioCicloService');

async function test() {
    await db.init();
    const pool = db.getDb();

    const igrejaId = 1;
    const dataInicial = '2026-04-06';
    const meses = 1;

    // 1. Check existing cycles
    const [ciclos] = await pool.execute('SELECT id, nome FROM ciclos WHERE igreja_id = ? AND ativo = 1 ORDER BY ordem ASC', [igrejaId]);
    console.log('CICLOS DISPONÍVEIS:', ciclos.map(c => `[${c.id}] ${c.nome}`).join(', '));

    if (ciclos.length === 0) {
        console.error('ERRO: Nenhum ciclo encontrado para a igreja 1. Rode o script de setup primeiro.');
        process.exit(1);
    }

    const cicloA = ciclos.find(c => c.nome.includes('A'))?.id || ciclos[0].id;

    // 2. Find organist "TESTE2" in that cycle
    const [items] = await pool.execute(`
        SELECT ci.organista_id, o.nome 
        FROM ciclo_itens ci 
        JOIN organistas o ON ci.organista_id = o.id 
        WHERE ci.ciclo_id = ? AND o.nome LIKE '%TESTE2%'
        LIMIT 1
    `, [cicloA]);

    if (items.length === 0) {
        console.error('ERRO: Organista TESTE2 não encontrado no ciclo selecionado.');
        process.exit(1);
    }

    const organistaId = items[0].organista_id;
    console.log(`TESTANDO PARTIDA FORÇADA: Ciclo ${cicloA}, Organista ${organistaId} (TESTE2)`);

    // 3. Generate
    try {
        const resultado = await gerarRodizioComCiclos(igrejaId, meses, cicloA, dataInicial, organistaId);

        console.log('\nRESULTADO DA PRIMEIRA DATA (2026-04-06):');
        const primeiraData = resultado.filter(r => r.data_culto.startsWith('2026-04-06'));

        primeiraData.forEach(r => {
            console.log(`[${r.data_culto}] ${r.funcao} -> ${r.organista_nome} (Ciclo: ${r.ciclo_origem})`);
        });

        const ok = primeiraData.every(r => r.organista_nome.includes('TESTE2'));
        if (ok) {
            console.log('\n✅ SUCESSO: Começou corretamente pela TESTE2.');
        } else {
            console.log('\n❌ FALHA: Não começou pela TESTE2.');
        }

    } catch (e) {
        console.error('Erro na geração:', e);
    }

    process.exit(0);
}

test();
