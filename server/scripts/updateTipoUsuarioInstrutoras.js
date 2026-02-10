const db = require('../database/db');

async function updateTipoUsuarioInstrutoras() {
  try {
    await db.init();
    const pool = db.getDb();
    
    console.log('Atualizando ENUM tipo_usuario para incluir "instrutoras"...');
    
    // Verificar se a coluna existe
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'usuarios' 
      AND COLUMN_NAME = 'tipo_usuario'
    `);
    
    if (columns.length === 0) {
      console.log('⚠️  Campo tipo_usuario não existe. Execute primeiro a migração addTipoUsuario.js');
      return;
    }
    
    const columnType = columns[0].COLUMN_TYPE;
    if (columnType.includes('instrutoras')) {
      console.log('✅ ENUM tipo_usuario já inclui "instrutoras"');
      return;
    }
    
    // Atualizar ENUM para incluir 'instrutoras'
    await pool.execute(`
      ALTER TABLE usuarios 
      MODIFY COLUMN tipo_usuario ENUM('encarregado', 'examinadora', 'instrutoras') DEFAULT NULL
    `);
    
    console.log('✅ ENUM tipo_usuario atualizado com sucesso!');
    console.log('   Valores possíveis agora: encarregado, examinadora, instrutoras, NULL');
    
  } catch (error) {
    console.error('❌ Erro ao atualizar ENUM tipo_usuario:', error);
    throw error;
  }
}

if (require.main === module) {
  updateTipoUsuarioInstrutoras()
    .then(() => {
      console.log('Migração concluída!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro na migração:', error);
      process.exit(1);
    });
}

module.exports = updateTipoUsuarioInstrutoras;
