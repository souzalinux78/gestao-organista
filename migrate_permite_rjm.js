
const db = require('./server/database/db');
require('dotenv').config({ path: './.env' });

async function migrate() {
    try {
        await db.init();
        const pool = db.getDb();

        console.log('--- Checking for permite_rjm column ---');

        // Check if column exists
        const [columns] = await pool.execute("SHOW COLUMNS FROM organistas LIKE 'permite_rjm'");

        if (columns.length === 0) {
            console.log('Column missing. Adding...');
            await pool.execute("ALTER TABLE organistas ADD COLUMN permite_rjm TINYINT(1) DEFAULT 0");
            console.log('Column added successfully.');
        } else {
            console.log('Column already exists.');
        }

        // Verify
        const [finalCols] = await pool.execute("SHOW COLUMNS FROM organistas LIKE 'permite_rjm'");
        console.table(finalCols);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

migrate();
