const db = require('../database/db');
const fs = require('fs');
const path = require('path');

async function debugQuery() {
    try {
        await db.init();
        const pool = db.getDb();

        const [igrejas] = await pool.query('SELECT id, nome FROM igrejas LIMIT 1');
        const igrejaId = igrejas[0].id;

        const output = {
            igreja: igrejas[0],
            raw_itens: [],
            join_ciclos: [],
            join_organistas: [],
            full_query: []
        };

        // 1. Check ciclo_itens directly
        const [rawItens] = await pool.query('SELECT * FROM ciclo_itens WHERE igreja_id = ?', [igrejaId]);
        output.raw_itens = rawItens;

        // 2. Check JOIN with Cycles
        const [joinCiclos] = await pool.query(`
            SELECT ci.id, c.nome as ciclo_nome, c.ativo
            FROM ciclo_itens ci
            LEFT JOIN ciclos c ON c.id = ci.ciclo_id
            WHERE ci.igreja_id = ?
        `, [igrejaId]);
        output.join_ciclos = joinCiclos;

        // 3. Check JOIN with Organistas
        const [joinOrg] = await pool.query(`
            SELECT ci.id, o.nome, o.ativa
            FROM ciclo_itens ci
            LEFT JOIN organistas o ON o.id = ci.organista_id
            WHERE ci.igreja_id = ?
        `, [igrejaId]);
        output.join_organistas = joinOrg;

        // 4. Run full query (getFilaMestra logic)
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
            ORDER BY c.ordem, ci.posicao
         `, [igrejaId]);
        output.full_query = fullQuery;

        fs.writeFileSync(path.join(__dirname, '../../debug_result.json'), JSON.stringify(output, null, 2));
        console.log('Results written to debug_result.json');

    } catch (e) {
        console.error(e);
    } finally {
        await db.close();
    }
}

debugQuery();
