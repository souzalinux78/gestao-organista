const db = require('../database/db');

async function addTipoUsuario() {
  try {
    await db.init();
    const pool = db.getDb();
    
    console.log('Adicionando campo tipo_usuario na tabela usuarios...');
    
    // Verificar se a coluna já existe
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'usuarios' 
      AND COLUMN_NAME = 'tipo_usuario'
    `);
    
    if (columns.length > 0) {
      console.log('✅ Campo tipo_usuario já existe na tabela usuarios');
      return;
    }
    
    // Adicionar coluna tipo_usuario
    await pool.execute(`
      ALTER TABLE usuarios 
      ADD COLUMN tipo_usuario ENUM('encarregado', 'examinadora') DEFAULT NULL 
      AFTER role
    `);
    
    console.log('✅ Campo tipo_usuario adicionado com sucesso!');
    console.log('   Valores possíveis: encarregado, examinadora, NULL');
    
  } catch (error) {
    console.error('❌ Erro ao adicionar campo tipo_usuario:', error);
    throw error;
  }
}

if (require.main === module) {
  addTipoUsuario()
    .then(() => {
      console.log('Migração concluída!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro na migração:', error);
      process.exit(1);
    });
}

module.exports = addTipoUsuario;
