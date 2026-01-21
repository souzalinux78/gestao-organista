const db = require('../database/db');

async function migrate() {
  try {
    await db.init();
    const pool = db.getDb();
    const dbTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 10000);

    console.log('🔄 Migração: mover ordem de organistas para organistas_igreja (ordem por igreja)\n');

    // 1. Verificar se a coluna ordem já existe em organistas_igreja
    const [colOrdemIgreja] = await pool.execute({
      sql: `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'organistas_igreja'
          AND COLUMN_NAME = 'ordem'
      `,
      timeout: dbTimeout
    });

    if (colOrdemIgreja.length === 0) {
      console.log('1️⃣ Adicionando coluna ordem em organistas_igreja...');
      
      // Adicionar coluna ordem em organistas_igreja
      await pool.execute({
        sql: `
          ALTER TABLE organistas_igreja
          ADD COLUMN ordem INT NULL AFTER igreja_id
        `,
        timeout: dbTimeout
      });
      console.log('   ✅ Coluna ordem adicionada em organistas_igreja');
    } else {
      console.log('   ℹ️ Coluna ordem já existe em organistas_igreja');
    }

    // 2. Migrar dados: copiar ordem de organistas para organistas_igreja
    console.log('\n2️⃣ Migrando dados de ordem...');
    
    const [organistasComOrdem] = await pool.execute({
      sql: `
        SELECT o.id as organista_id, o.ordem
        FROM organistas o
        WHERE o.ordem IS NOT NULL
      `,
      timeout: dbTimeout
    });

    let migrados = 0;
    for (const org of organistasComOrdem) {
      // Para cada organista com ordem, atualizar todas as suas associações com igrejas
      // Usar a ordem da organista para todas as igrejas (comportamento inicial)
      await pool.execute({
        sql: `
          UPDATE organistas_igreja
          SET ordem = ?
          WHERE organista_id = ? AND ordem IS NULL
        `,
        values: [org.ordem, org.organista_id],
        timeout: dbTimeout
      });
      migrados++;
    }
    
    console.log(`   ✅ ${migrados} organista(s) com ordem migrada(s)`);

    // 3. Criar UNIQUE constraint composto (igreja_id, ordem) em organistas_igreja
    console.log('\n3️⃣ Criando constraint único (igreja_id, ordem)...');
    
    const [idxOrdemIgreja] = await pool.execute({
      sql: `
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'organistas_igreja'
          AND INDEX_NAME = 'unique_organistas_igreja_ordem'
      `,
      timeout: dbTimeout
    });

    if (idxOrdemIgreja.length === 0) {
      // Primeiro, remover ordens duplicadas por igreja (manter apenas a primeira)
      console.log('   Limpando ordens duplicadas por igreja...');
      
      await pool.execute({
        sql: `
          UPDATE organistas_igreja oi1
          SET ordem = NULL
          WHERE ordem IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM organistas_igreja oi2
            WHERE oi2.igreja_id = oi1.igreja_id
            AND oi2.ordem = oi1.ordem
            AND oi2.id < oi1.id
          )
        `,
        timeout: dbTimeout
      });

      // Criar índice único composto
      await pool.execute({
        sql: `
          ALTER TABLE organistas_igreja
          ADD UNIQUE KEY unique_organistas_igreja_ordem (igreja_id, ordem)
        `,
        timeout: dbTimeout
      });
      console.log('   ✅ Constraint único criado: (igreja_id, ordem)');
    } else {
      console.log('   ℹ️ Constraint único já existe');
    }

    // 4. Remover UNIQUE constraint global de organistas.ordem
    console.log('\n4️⃣ Removendo constraint único global de organistas.ordem...');
    
    const [idxOrdemGlobal] = await pool.execute({
      sql: `
        SELECT INDEX_NAME
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'organistas'
          AND INDEX_NAME = 'unique_organistas_ordem'
      `,
      timeout: dbTimeout
    });

    if (idxOrdemGlobal.length > 0) {
      await pool.execute({
        sql: `
          ALTER TABLE organistas
          DROP INDEX unique_organistas_ordem
        `,
        timeout: dbTimeout
      });
      console.log('   ✅ Constraint único global removido');
    } else {
      console.log('   ℹ️ Constraint único global já não existe');
    }

    // 5. Opcional: remover coluna ordem de organistas (comentado para manter compatibilidade temporária)
    // await pool.execute('ALTER TABLE organistas DROP COLUMN ordem');
    // console.log('   ✅ Coluna ordem removida de organistas');

    console.log('\n✅ Migração concluída com sucesso!');
    console.log('\n📝 Nota: A coluna ordem em organistas foi mantida para compatibilidade.');
    console.log('   O sistema agora usa ordem de organistas_igreja (ordem por igreja).');

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    await db.close();
    process.exit(1);
  }
}

migrate();
