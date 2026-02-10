const db = require('../database/db');

async function migrate() {
  try {
    await db.init();
    const pool = db.getDb();
    
    console.log('Adicionando campo mesma_organista_ambas_funcoes na tabela igrejas...');
    
    // Verificar se a coluna já existe
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'igrejas' 
      AND COLUMN_NAME = 'mesma_organista_ambas_funcoes'
    `);
    
    if (columns.length === 0) {
      await pool.execute(`
        ALTER TABLE igrejas 
        ADD COLUMN mesma_organista_ambas_funcoes TINYINT(1) DEFAULT 0 
        AFTER encarregado_regional_telefone
      `);
      console.log('✅ Campo mesma_organista_ambas_funcoes adicionado com sucesso!');
    } else {
      console.log('ℹ️ Campo mesma_organista_ambas_funcoes já existe.');
    }
    
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    await db.close();
    process.exit(1);
  }
}

migrate();
