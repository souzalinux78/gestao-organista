const db = require('../database/db');

async function ensureIndex(pool, table, indexName, createSql) {
  const [rows] = await pool.execute(
    `
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    LIMIT 1
  `,
    [table, indexName]
  );

  if (rows.length > 0) {
    console.log(`ℹ️ Índice ${table}.${indexName} já existe`);
    return false;
  }

  try {
    await pool.execute(createSql);
    console.log(`✅ Índice criado: ${table}.${indexName}`);
    return true;
  } catch (err) {
    if (err.code === 'ER_DUP_KEYNAME') {
      console.log(`ℹ️ Índice ${table}.${indexName} já existe (corrida)`);
      return false;
    }
    throw err;
  }
}

async function migrate() {
  try {
    await db.init();
    const pool = db.getDb();

    console.log('🔄 Migração: criar índices faltantes para performance (acesso multi-igreja)');

    // usuario_igreja
    await ensureIndex(
      pool,
      'usuario_igreja',
      'idx_usuario_igreja_usuario',
      'CREATE INDEX idx_usuario_igreja_usuario ON usuario_igreja(usuario_id)'
    );
    await ensureIndex(
      pool,
      'usuario_igreja',
      'idx_usuario_igreja_igreja',
      'CREATE INDEX idx_usuario_igreja_igreja ON usuario_igreja(igreja_id)'
    );

    // organistas_igreja
    await ensureIndex(
      pool,
      'organistas_igreja',
      'idx_organistas_igreja_organista',
      'CREATE INDEX idx_organistas_igreja_organista ON organistas_igreja(organista_id)'
    );
    await ensureIndex(
      pool,
      'organistas_igreja',
      'idx_organistas_igreja_igreja',
      'CREATE INDEX idx_organistas_igreja_igreja ON organistas_igreja(igreja_id)'
    );
    await ensureIndex(
      pool,
      'organistas_igreja',
      'idx_organistas_igreja_oficializada',
      'CREATE INDEX idx_organistas_igreja_oficializada ON organistas_igreja(oficializada)'
    );

    console.log('✅ Migração de índices concluída.');
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração de índices:', error);
    await db.close();
    process.exit(1);
  }
}

migrate();

