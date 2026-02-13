// Migração: Adicionar tipo e número aos ciclos
// Execução via Node.js para compatibilidade multi-versão MySQL

const db = require('./server/database/db');

async function migrate() {
    await db.init();
    const pool = db.getDb();

    console.log('=== Iniciando migração: Tipos e Números de Ciclos ===\n');

    try {
        // 1. Adicionar colunas
        console.log('1. Adicionando colunas tipo e numero...');
        try {
            await pool.execute(`
        ALTER TABLE ciclos 
        ADD COLUMN tipo ENUM('oficial', 'rjm') NOT NULL DEFAULT 'oficial'
      `);
            console.log('   ✓ Coluna tipo adicionada');
        } catch (e) {
            if (e.message.includes('Duplicate column')) {
                console.log('   ℹ️  Coluna tipo já existe');
            } else throw e;
        }

        try {
            await pool.execute(`
        ALTER TABLE ciclos 
        ADD COLUMN numero INT NULL
      `);
            console.log('   ✓ Coluna numero adicionada');
        } catch (e) {
            if (e.message.includes('Duplicate column')) {
                console.log('   ℹ️  Coluna numero já existe');
            } else throw e;
        }

        // 2. Classificar ciclos RJM baseado em vínculos
        console.log('\n2. Classificando ciclos RJM...');
        const [updateRJM] = await pool.execute(`
      UPDATE ciclos c
      SET c.tipo = 'rjm'
      WHERE EXISTS (
        SELECT 1 FROM cultos k 
        WHERE k.ciclo_id = c.id 
        AND (k.tipo = 'rjm' OR k.eh_rjm = 1)
      )
      AND c.ativo = 1
    `);
        console.log(`   ✓ ${updateRJM.affectedRows} ciclos classificados como RJM`);

        // 3. Numerar ciclos oficiais
        console.log('\n3. Numerando ciclos oficiais...');

        // Buscar igrejas com ciclos
        const [igrejas] = await pool.execute(`
      SELECT DISTINCT igreja_id FROM ciclos WHERE ativo = 1
    `);

        for (const igreja of igrejas) {
            const [ciclosOficiais] = await pool.execute(`
        SELECT id FROM ciclos 
        WHERE igreja_id = ? AND tipo = 'oficial' AND ativo = 1 
        ORDER BY ordem ASC
      `, [igreja.igreja_id]);

            let numero = 1;
            for (const ciclo of ciclosOficiais) {
                await pool.execute(
                    'UPDATE ciclos SET numero = ? WHERE id = ?',
                    [numero, ciclo.id]
                );
                numero++;
            }

            console.log(`   ✓ Igreja ${igreja.igreja_id}: ${ciclosOficiais.length} ciclos numerados`);
        }

        // 4. Criar índice
        console.log('\n4. Criando índice único...');
        try {
            await pool.execute(`
        CREATE UNIQUE INDEX idx_igreja_tipo_numero 
        ON ciclos(igreja_id, tipo, numero)
      `);
            console.log('   ✓ Índice criado');
        } catch (e) {
            if (e.message.includes('Duplicate key name')) {
                console.log('   ℹ️  Índice já existe');
            } else throw e;
        }

        // 5. Verificação final
        console.log('\n5. Verificação final...');
        const [result] = await pool.execute(`
      SELECT 
        igreja_id,
        id,
        nome,
        tipo,
        numero,
        ordem,
        ativo
      FROM ciclos
      WHERE ativo = 1
      ORDER BY igreja_id, tipo DESC, numero, ordem
    `);

        console.log('\n📊 Ciclos migrados:');
        result.forEach(c => {
            const label = c.tipo === 'oficial' ? `Oficial ${c.numero}` : 'RJM';
            console.log(`   Igreja ${c.igreja_id}: ${c.nome} [${label}]`);
        });

        console.log('\n✅ Migração concluída com sucesso!');

    } catch (error) {
        console.error('\n❌ Erro na migração:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

migrate().catch(console.error);
