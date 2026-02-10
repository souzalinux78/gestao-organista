/**
 * Migração: Adicionar campo de contato para aviso de escala
 * Sistema de Gestão de Organistas
 * 
 * Este campo permite que um encarregado ou responsável receba
 * uma cópia da mensagem enviada à organista quando ela for escalada.
 * Campo OPCIONAL - se não preenchido, o sistema funciona normalmente.
 */

const db = require('../database/db');
const mysql = require('mysql2/promise');

async function migrate() {
  let connection = null;
  
  try {
    const pool = db.getDb();
    connection = await pool.getConnection();
    
    console.log('🔄 Iniciando migração: Adicionar campo contato_aviso_escala_telefone...');
    
    // Verificar se a coluna já existe
    const [columns] = await connection.execute(
      `SELECT COUNT(*) as count 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'igrejas'
         AND COLUMN_NAME = 'contato_aviso_escala_telefone'`
    );
    
    if (columns[0].count > 0) {
      console.log('✅ Coluna contato_aviso_escala_telefone já existe. Migração não necessária.');
      return;
    }
    
    // Adicionar coluna
    await connection.execute(
      `ALTER TABLE \`igrejas\` 
       ADD COLUMN \`contato_aviso_escala_telefone\` VARCHAR(20) NULL 
       AFTER \`encarregado_regional_telefone\``
    );
    
    console.log('✅ Migração concluída: Campo contato_aviso_escala_telefone adicionado à tabela igrejas');
    console.log('📝 O campo está disponível para uso no cadastro de igrejas.');
    console.log('📝 Quando preenchido, o contato receberá uma cópia da mensagem enviada à organista.');
    
  } catch (error) {
    console.error('❌ Erro ao executar migração:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Executar migração se chamado diretamente
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Migração finalizada com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro na migração:', error);
      process.exit(1);
    });
}

module.exports = migrate;
