/**
 * Script de Migração: Índices de Performance
 * 
 * Adiciona índices MySQL para otimizar queries frequentes.
 * Pode ser executado múltiplas vezes (usa IF NOT EXISTS).
 */

const db = require('../database/db');

const createPerformanceIndexes = async () => {
  const pool = db.getDb();
  
  console.log('🔄 Iniciando criação de índices de performance...\n');
  
  try {
    // 1. Índice composto para rodizios (igreja + data) - MUITO USADO
    try {
      await pool.execute(`
        CREATE INDEX idx_rodizios_igreja_data 
        ON rodizios(igreja_id, data_culto)
      `);
      console.log('✅ Índice idx_rodizios_igreja_data criado');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Índice idx_rodizios_igreja_data já existe');
      } else {
        throw error;
      }
    }
    
    // 2. Índice composto para cultos (igreja + ativo)
    try {
      await pool.execute(`
        CREATE INDEX idx_cultos_igreja_ativo 
        ON cultos(igreja_id, ativo)
      `);
      console.log('✅ Índice idx_cultos_igreja_ativo criado');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Índice idx_cultos_igreja_ativo já existe');
      } else {
        throw error;
      }
    }
    
    // 3. Índice para organistas_igreja (igreja + ordem) - se ordem for usada
    try {
      await pool.execute(`
        CREATE INDEX idx_organistas_igreja_igreja_ordem 
        ON organistas_igreja(igreja_id, ordem)
      `);
      console.log('✅ Índice idx_organistas_igreja_igreja_ordem criado');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Índice idx_organistas_igreja_igreja_ordem já existe');
      } else {
        // Se coluna ordem não existir, ignorar
        if (error.code === 'ER_BAD_FIELD_ERROR') {
          console.log('⚠️  Coluna ordem não existe ainda - índice será criado quando coluna for adicionada');
        } else {
          throw error;
        }
      }
    }
    
    // 4. Índice para rodizios (data_culto) - para queries de período
    try {
      await pool.execute(`
        CREATE INDEX idx_rodizios_data 
        ON rodizios(data_culto)
      `);
      console.log('✅ Índice idx_rodizios_data criado');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Índice idx_rodizios_data já existe');
      } else {
        throw error;
      }
    }
    
    // 5. Verificar índice em usuarios.email (geralmente já existe como UNIQUE)
    try {
      const [emailIndex] = await pool.execute(`
        SHOW INDEX FROM usuarios WHERE Column_name = 'email'
      `);
      if (emailIndex.length === 0) {
        await pool.execute(`
          CREATE INDEX idx_usuarios_email ON usuarios(email)
        `);
        console.log('✅ Índice idx_usuarios_email criado');
      } else {
        console.log('ℹ️  Índice em usuarios.email já existe (UNIQUE)');
      }
    } catch (error) {
      console.log('⚠️  Aviso ao verificar índice usuarios.email:', error.message);
    }
    
    // 6. Índice para organistas (ativa, oficializada) - se usado em WHERE
    try {
      await pool.execute(`
        CREATE INDEX idx_organistas_ativa_oficializada 
        ON organistas(ativa, oficializada)
      `);
      console.log('✅ Índice idx_organistas_ativa_oficializada criado');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Índice idx_organistas_ativa_oficializada já existe');
      } else {
        throw error;
      }
    }
    
    // 7. Índice para notificacoes (rodizio_id) - se usado em JOINs
    try {
      await pool.execute(`
        CREATE INDEX idx_notificacoes_rodizio 
        ON notificacoes(rodizio_id)
      `);
      console.log('✅ Índice idx_notificacoes_rodizio criado');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Índice idx_notificacoes_rodizio já existe');
      } else {
        throw error;
      }
    }
    
    // 8. Índice para rodizios (culto_id) - se usado em JOINs
    try {
      await pool.execute(`
        CREATE INDEX idx_rodizios_culto 
        ON rodizios(culto_id)
      `);
      console.log('✅ Índice idx_rodizios_culto criado');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Índice idx_rodizios_culto já existe');
      } else {
        throw error;
      }
    }
    
    // 9. Índice para rodizios (organista_id) - se usado em JOINs
    try {
      await pool.execute(`
        CREATE INDEX idx_rodizios_organista 
        ON rodizios(organista_id)
      `);
      console.log('✅ Índice idx_rodizios_organista criado');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Índice idx_rodizios_organista já existe');
      } else {
        throw error;
      }
    }
    
    console.log('\n✅ Todos os índices de performance verificados/criados com sucesso!');
    
    // Mostrar estatísticas
    console.log('\n📊 Estatísticas dos índices criados:');
    const tables = ['rodizios', 'cultos', 'organistas_igreja', 'organistas', 'notificacoes', 'usuarios'];
    for (const table of tables) {
      try {
        const [indexes] = await pool.execute(`SHOW INDEX FROM ${table}`);
        const uniqueIndexes = indexes.filter(idx => idx.Non_unique === 0).length;
        const regularIndexes = indexes.length - uniqueIndexes;
        console.log(`  ${table}: ${regularIndexes} índices regulares, ${uniqueIndexes} índices únicos`);
      } catch (error) {
        // Tabela pode não existir ainda
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar índices:', error.message);
    throw error;
  }
};

// Executar se chamado diretamente
if (require.main === module) {
  db.init()
    .then(() => createPerformanceIndexes())
    .then(() => {
      console.log('\n✅ Migração de índices concluída com sucesso!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Erro na migração:', err);
      process.exit(1);
    });
}

module.exports = { createPerformanceIndexes };
