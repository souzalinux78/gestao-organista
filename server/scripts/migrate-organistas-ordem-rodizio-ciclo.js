const db = require('../database/db');

async function migrate() {
  try {
    await db.init();
    const pool = db.getDb();

    console.log('Iniciando migração: organistas.ordem e igrejas.rodizio_ciclo...');

    // organistas.ordem
    const [colOrdem] = await pool.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'organistas'
        AND COLUMN_NAME = 'ordem'
    `);

    if (colOrdem.length === 0) {
      await pool.execute(`
        ALTER TABLE organistas
        ADD COLUMN ordem INT NULL AFTER id
      `);
      console.log('✅ Coluna organistas.ordem adicionada');
    } else {
      console.log('ℹ️ Coluna organistas.ordem já existe');
    }

    // unique index em ordem
    const [idxOrdem] = await pool.execute(`
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'organistas'
        AND INDEX_NAME = 'unique_organistas_ordem'
    `);

    if (idxOrdem.length === 0) {
      await pool.execute(`
        ALTER TABLE organistas
        ADD UNIQUE KEY unique_organistas_ordem (ordem)
      `);
      console.log('✅ Índice unique_organistas_ordem criado');
    } else {
      console.log('ℹ️ Índice unique_organistas_ordem já existe');
    }

    // igrejas.rodizio_ciclo
    const [colCiclo] = await pool.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'igrejas'
        AND COLUMN_NAME = 'rodizio_ciclo'
    `);

    if (colCiclo.length === 0) {
      await pool.execute(`
        ALTER TABLE igrejas
        ADD COLUMN rodizio_ciclo INT NOT NULL DEFAULT 0
        AFTER mesma_organista_ambas_funcoes
      `);
      console.log('✅ Coluna igrejas.rodizio_ciclo adicionada');
    } else {
      console.log('ℹ️ Coluna igrejas.rodizio_ciclo já existe');
    }

    await db.close();
    console.log('✅ Migração concluída com sucesso');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    try {
      await db.close();
    } catch (_) {}
    process.exit(1);
  }
}

migrate();

