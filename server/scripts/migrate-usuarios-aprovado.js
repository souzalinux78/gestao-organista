const db = require('../database/db');

async function migrate() {
  try {
    await db.init();
    const pool = db.getDb();
    
    console.log('Adicionando campo aprovado na tabela usuarios...');
    
    // Verificar se a coluna já existe
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'usuarios' 
      AND COLUMN_NAME = 'aprovado'
    `);
    
    if (columns.length === 0) {
      await pool.execute(`
        ALTER TABLE usuarios 
        ADD COLUMN aprovado TINYINT(1) DEFAULT 0 
        AFTER ativo
      `);
      
      // Aprovar todos os usuários existentes (incluindo admin)
      await pool.execute(`
        UPDATE usuarios 
        SET aprovado = 1 
        WHERE aprovado = 0
      `);
      
      console.log('✅ Campo aprovado adicionado com sucesso!');
      console.log('✅ Todos os usuários existentes foram aprovados automaticamente.');
    } else {
      console.log('ℹ️ Campo aprovado já existe.');
    }
    
    // Criar índice se não existir
    try {
      await pool.execute(`
        CREATE INDEX idx_usuarios_aprovado ON usuarios(aprovado)
      `);
      console.log('✅ Índice idx_usuarios_aprovado criado.');
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') {
        throw err;
      }
      console.log('ℹ️ Índice idx_usuarios_aprovado já existe.');
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
