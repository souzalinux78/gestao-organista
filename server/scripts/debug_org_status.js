const db = require('../database/db');
async function debug() {
    await db.init();
    const [rows] = await db.getDb().query("SELECT * FROM organistas WHERE nome = 'RJM1'");
    console.log(JSON.stringify(rows, null, 2));
    await db.close();
}
debug();
