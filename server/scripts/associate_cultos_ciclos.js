const mysql = require('mysql2/promise');
const { getDb } = require('../database/db');

const migrateConnectCultosCiclos = async () => {
    const pool = getDb();
    console.log('🔗 Iniciando migração: Associar Cultos a Ciclos...');

    try {
        // 1. Check if column exists
        const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'cultos' 
      AND COLUMN_NAME = 'ciclo_id'
    `);

        if (columns.length === 0) {
            console.log('➕ Adicionando coluna ciclo_id em cultos...');
            await pool.execute(`
        ALTER TABLE cultos 
        ADD COLUMN ciclo_id INT NULL AFTER igreja_id,
        ADD FOREIGN KEY (ciclo_id) REFERENCES ciclos(id) ON DELETE SET NULL
      `);
            console.log('✅ Coluna ciclo_id adicionada!');
        } else {
            console.log('ℹ️ Coluna ciclo_id já existe.');
        }

        // 2. Initial Data Population (Optional but helpful)
        // If we have "RJM" cycles and "RJM" cultos, let's link them automatically.

        // Find RJM cycles
        const [rjmCycles] = await pool.execute(`SELECT id, igreja_id FROM ciclos WHERE nome = 'RJM'`);

        for (const cycle of rjmCycles) {
            // Find RJM cultos for this church
            await pool.execute(`
        UPDATE cultos 
        SET ciclo_id = ? 
        WHERE igreja_id = ? AND tipo = 'rjm' AND ciclo_id IS NULL
      `, [cycle.id, cycle.igreja_id]);
        }

        // Find Cultos cycles (Normal)
        const [normalCycles] = await pool.execute(`SELECT id, igreja_id FROM ciclos WHERE nome = 'Cultos'`);

        for (const cycle of normalCycles) {
            // Find Official cultos for this church
            await pool.execute(`
        UPDATE cultos 
        SET ciclo_id = ? 
        WHERE igreja_id = ? AND tipo = 'culto_oficial' AND ciclo_id IS NULL
      `, [cycle.id, cycle.igreja_id]);
        }

        console.log('🔄 Associação inicial automática concluída (RJM->RJM, Oficial->Cultos).');
        console.log('🏁 Migração de Associação concluída com sucesso!');

    } catch (error) {
        console.error('❌ Erro na migração:', error);
        throw error;
    }
};

// Se executado diretamente
if (require.main === module) {
    (async () => {
        const db = require('../database/db');
        // Ensure we have a config environment (dotenv might need loading if not auto)
        require('dotenv').config();
        await db.init();
        await migrateConnectCultosCiclos();
        await db.close();
        process.exit(0);
    })();
}

module.exports = migrateConnectCultosCiclos;
