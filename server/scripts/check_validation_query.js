const db = require('../database/db');

async function debugQuery() {
    try {
        await db.init();
        const pool = db.getDb();

        const [igrejas] = await pool.query('SELECT id, nome FROM igrejas LIMIT 1');
        const igrejaId = igrejas[0].id;
        console.log(`Checking Igreja ID: ${igrejaId} (${igrejas[0].nome})`);

        // 1. Check ciclo_itens directly
        const [rawItens] = await pool.query('SELECT * FROM ciclo_itens WHERE igreja_id = ?', [igrejaId]);
        console.log(`Raw ciclo_itens count: ${rawItens.length}`);
        if (rawItens.length > 0) {
            console.log('Sample item:', rawItens[0]);
        }

        // 2. Check JOIN with Cycles
        const [joinCiclos] = await pool.query(`
            SELECT ci.id, c.nome as ciclo_nome, c.ativo
            FROM ciclo_itens ci
            LEFT JOIN ciclos c ON c.id = ci.ciclo_id
            WHERE ci.igreja_id = ?
        `, [igrejaId]);
        console.log('Exibindo status do JOIN com Ciclos:', JSON.stringify(joinCiclos, null, 2));

        // 3. Check JOIN with Organistas
        const [joinOrg] = await pool.query(`
            SELECT ci.id, o.nome, o.ativa
            FROM ciclo_itens ci
            LEFT JOIN organistas o ON o.id = ci.organista_id
            WHERE ci.igreja_id = ?
        `, [igrejaId]);
        console.log('Exibindo status do JOIN com Organistas:', JSON.stringify(joinOrg, null, 2));

        // 4. Run full query
        const [fullQuery] = await pool.execute(
            `SELECT ci.ciclo_id, ci.posicao, ci.organista_id,
            o.nome as organista_nome, o.categoria,
            COALESCE(oi.oficializada, o.oficializada, 0) as oficializada,
            c.nome as ciclo_nome, c.ordem as ciclo_ordem
            FROM ciclo_itens ci
            INNER JOIN organistas o ON o.id = ci.organista_id
            INNER JOIN ciclos c ON c.id = ci.ciclo_id
            LEFT JOIN organistas_igreja oi ON oi.organista_id = o.id AND oi.igreja_id = ci.igreja_id
            WHERE ci.igreja_id = ? AND c.ativo = 1
         `, [igrejaId]);
        console.log(`Full Query returned ${fullQuery.length} rows.`);

    } catch (e) {
        console.error(e);
    } finally {
        await db.close();
    }
}

debugQuery();
