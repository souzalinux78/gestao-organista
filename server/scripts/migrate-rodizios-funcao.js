const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../database/db');

async function migrateRodiziosFuncao() {
  // Inicializar banco de dados
  try {
    await db.init();
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error);
    process.exit(1);
  }
  
  const pool = db.getDb();
  
  try {
    console.log('Iniciando migração: adicionando coluna funcao na tabela rodizios...');
    
    // Verificar se a coluna já existe
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'rodizios' 
       AND COLUMN_NAME = 'funcao'`
    );
    
    if (columns.length === 0) {
      // Adicionar coluna funcao
      try {
        await pool.execute(`
          ALTER TABLE rodizios 
          ADD COLUMN funcao ENUM('meia_hora', 'tocar_culto') NOT NULL DEFAULT 'tocar_culto' 
          AFTER dia_semana
        `);
        console.log('✅ Coluna funcao adicionada com sucesso!');
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log('ℹ️ Coluna funcao já existe.');
        } else {
          throw error;
        }
      }
      
      // Adicionar índice único
      try {
        await pool.execute(`
          ALTER TABLE rodizios 
          ADD UNIQUE KEY unique_rodizio_culto_funcao (culto_id, data_culto, funcao)
        `);
        console.log('✅ Índice único adicionado com sucesso!');
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_DUP_ENTRY') {
          console.log('ℹ️ Índice único já existe ou há duplicatas. Verifique manualmente.');
        } else {
          throw error;
        }
      }
    } else {
      console.log('ℹ️ Coluna funcao já existe na tabela rodizios.');
    }
    
    // Atualizar rodízios existentes para ter função padrão
    const [updated] = await pool.execute(
      `UPDATE rodizios SET funcao = 'tocar_culto' WHERE funcao IS NULL OR funcao = ''`
    );
    
    if (updated.affectedRows > 0) {
      console.log(`✅ ${updated.affectedRows} rodízios atualizados com função padrão.`);
    }
    
    console.log('✅ Migração concluída com sucesso!');
    
    // Fechar conexão
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    await db.close().catch(() => {});
    process.exit(1);
  }
}

migrateRodiziosFuncao();
