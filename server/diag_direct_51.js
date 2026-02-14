const mysql = require('mysql2/promise');
const fs = require('fs');

async function run() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'FLoc25GD!',
        database: 'gestao_organista'
    });

    try {
        const [cultos] = await connection.execute('SELECT id, dia_semana, hora, tipo FROM cultos WHERE igreja_id = 51 AND ativo = 1');
        const [organistas] = await connection.execute(
            `SELECT o.id, o.nome, oi.oficializada 
       FROM organistas o 
       INNER JOIN organistas_igreja oi ON o.id = oi.organista_id 
       WHERE oi.igreja_id = 51 AND o.ativa = 1`
        );

        const results = {
            cultos,
            organistas
        };

        fs.writeFileSync('diag_result_51.json', JSON.stringify(results, null, 2));
        console.log('Dados salvos em diag_result_51.json');
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
        process.exit();
    }
}

run();
