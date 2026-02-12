const fs = require('fs');
const db = require('./server/database/db');

async function logError(err) {
    const msg = `[${new Date().toISOString()}] ERRO: ${err.message}\nSTACK: ${err.stack}\n`;
    console.error(msg);
    fs.writeFileSync('migration_error.log', msg);
}

async function migrateStrictRules() {
    const pool = db.getDb();
    console.log('🚀 Iniciando migração para Regras Estritas (V2)...');

    try {
        // 1. Criar tabela `ciclos`
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS ciclos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        igreja_id INT NOT NULL,
        nome VARCHAR(100) NOT NULL,
        ordem INT NOT NULL DEFAULT 1,
        ativo TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (igreja_id) REFERENCES igrejas(id) ON DELETE CASCADE,
        UNIQUE KEY unique_ciclo_igreja_nome (igreja_id, nome)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('✅ Tabela `ciclos` criada.');

        // 2. Modificar tabela `organistas`
        try {
            const [colsOrg] = await pool.execute(`SHOW COLUMNS FROM organistas LIKE 'categoria'`);
            if (colsOrg.length === 0) {
                await pool.execute(`
            ALTER TABLE organistas 
            ADD COLUMN categoria ENUM('oficial', 'rjm', 'aluna') NOT NULL DEFAULT 'oficial' 
            AFTER oficializada
        `);
                console.log('✅ Coluna `categoria` adicionada em `organistas`.');

                // Migrar dados existentes: oficializada=0 -> aluna
                await pool.execute(`UPDATE organistas SET categoria = 'aluna' WHERE oficializada = 0`);
                console.log('🔄 Dados de organistas migrados (Alunas).');
            } else {
                console.log('ℹ️ Coluna `categoria` já existe em `organistas`.');
            }
        } catch (e) {
            console.log('⚠️ Erro ao adicionar categoria:', e.message);
        }

        // 3. Modificar tabela `cultos`
        try {
            const [colsCulto] = await pool.execute(`SHOW COLUMNS FROM cultos LIKE 'tipo'`);
            if (colsCulto.length === 0) {
                await pool.execute(`
            ALTER TABLE cultos 
            ADD COLUMN tipo ENUM('culto_oficial', 'rjm', 'outro') NOT NULL DEFAULT 'culto_oficial' 
            AFTER hora
        `);
                console.log('✅ Coluna `tipo` adicionada em `cultos`.');
            } else {
                console.log('ℹ️ Coluna `tipo` já existe em `cultos`.');
            }
        } catch (e) {
            console.log('⚠️ Erro ao adicionar tipo:', e.message);
        }

        // 4. Modificar tabela `ciclo_itens`
        try {
            const [colsCicloItens] = await pool.execute(`SHOW COLUMNS FROM ciclo_itens LIKE 'ciclo_id'`);
            if (colsCicloItens.length === 0) {
                await pool.execute(`
            ALTER TABLE ciclo_itens 
            ADD COLUMN ciclo_id INT NULL AFTER igreja_id,
            ADD FOREIGN KEY (ciclo_id) REFERENCES ciclos(id) ON DELETE CASCADE
        `);
                console.log('✅ Coluna `ciclo_id` adicionada em `ciclo_itens`.');
            } else {
                console.log('ℹ️ Coluna `ciclo_id` já existe em `ciclo_itens`.');
            }
        } catch (e) {
            console.log('⚠️ Erro ao adicionar ciclo_id:', e.message);
        }

        // 5. Migrar dados de Ciclos
        try {
            const [igrejas] = await pool.execute('SELECT id FROM igrejas');

            for (const igreja of igrejas) {
                const [ciclosExistentes] = await pool.execute('SELECT * FROM ciclos WHERE igreja_id = ?', [igreja.id]);

                if (ciclosExistentes.length === 0) {
                    const [res1] = await pool.execute(
                        'INSERT INTO ciclos (igreja_id, nome, ordem) VALUES (?, ?, ?)',
                        [igreja.id, 'Cultos', 1]
                    );
                    const idCultos = res1.insertId;

                    const [res2] = await pool.execute(
                        'INSERT INTO ciclos (igreja_id, nome, ordem) VALUES (?, ?, ?)',
                        [igreja.id, 'RJM', 2]
                    );
                    const idRJM = res2.insertId;

                    console.log(`🔄 Ciclos padrão criados para igreja ${igreja.id}: Cultos e RJM.`);

                    // Migração segura
                    try {
                        await pool.execute('UPDATE ciclo_itens SET ciclo_id = ? WHERE igreja_id = ? AND numero_ciclo = 1', [idCultos, igreja.id]);
                    } catch (e) { console.log('Erro ao atualizar ciclo 1', e.message); }

                    try {
                        await pool.execute('UPDATE ciclo_itens SET ciclo_id = ? WHERE igreja_id = ? AND numero_ciclo = 2', [idRJM, igreja.id]);
                    } catch (e) { console.log('Erro ao atualizar ciclo 2', e.message); }

                    // Fallback
                    try {
                        await pool.execute('UPDATE ciclo_itens SET ciclo_id = ? WHERE igreja_id = ? AND ciclo_id IS NULL', [idCultos, igreja.id]);
                    } catch (e) { console.log('Erro ao atualizar ciclo fallback', e.message); }
                }
            }
        } catch (e) {
            console.log('⚠️ Erro na migração de dados de ciclos:', e.message);
        }

        console.log('🏁 Migração de Regras Estritas concluída com sucesso!');
    } catch (error) {
        await logError(error);
        throw error;
    }
};

async function run() {
    try {
        console.log('Iniciando DB...');
        try {
            await db.init();
        } catch (e) {
            await logError(e);
            process.exit(1);
        }
        console.log('DB Inicializado. executando migração...');
        await migrateStrictRules();
        console.log('Sucesso!');
        process.exit(0);
    } catch (err) {
        await logError(err);
        process.exit(1);
    }
}

run();
