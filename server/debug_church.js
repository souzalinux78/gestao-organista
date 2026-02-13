const db = require('./database/db');

async function debugChurch(id) {
    const pool = db.getDb();
    try {
        const [igrejas] = await pool.execute('SELECT id, nome FROM igrejas WHERE id = ?', [id]);
        console.log('--- IGREJA ---');
        console.table(igrejas);

        const [cultos] = await pool.execute('SELECT id, dia_semana, hora_culto, tipo FROM cultos WHERE igreja_id = ? AND ativo = 1', [id]);
        console.log('\n--- CULTOS ATIVOS ---');
        console.table(cultos);

        const [organistas] = await pool.execute(
            `SELECT o.id, o.nome, oi.oficializada 
       FROM organistas o 
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id 
       WHERE oi.igreja_id = ? AND o.ativa = 1`,
            [id]
        );
        console.log('\n--- ORGANISTAS ATIVAS ---');
        console.table(organistas);

    } catch (err) {
        console.error('Erro no debug:', err);
    } finally {
        process.exit();
    }
}

debugChurch(51);
