const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

const init = async () => {
  try {
    // Criar banco de dados se não existir (antes de criar o pool)
    await createDatabaseIfNotExists();
    
    // Criar pool de conexões
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'FLoc25GD!',
      database: process.env.DB_NAME || 'gestao_organista',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Testar conexão
    const connection = await pool.getConnection();
    console.log('Conectado ao banco de dados MySQL');
    connection.release();
    
    // Criar tabelas
    await createTables();
    
    // Verificar e adicionar coluna funcao se necessário (migração)
    await migrateRodiziosFuncao();
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
    throw error;
  }
};

const createDatabaseIfNotExists = async () => {
  const dbName = process.env.DB_NAME || 'gestao_organista';
  
  // Criar conexão sem especificar o banco
  const tempPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'FLoc25GD!',
    waitForConnections: true,
    connectionLimit: 1
  });

  try {
    await tempPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`Banco de dados '${dbName}' verificado/criado`);
  } catch (error) {
    console.error('Erro ao criar banco de dados:', error);
  } finally {
    await tempPool.end();
  }
};

const createTables = async () => {
  const queries = [
    // Tabela de Organistas
    `CREATE TABLE IF NOT EXISTS organistas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      telefone VARCHAR(20),
      email VARCHAR(255),
      oficializada TINYINT(1) DEFAULT 0,
      ativa TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Tabela de Igrejas
    `CREATE TABLE IF NOT EXISTS igrejas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      endereco TEXT,
      encarregado_local_nome VARCHAR(255),
      encarregado_local_telefone VARCHAR(20),
      encarregado_regional_nome VARCHAR(255),
      encarregado_regional_telefone VARCHAR(20),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Tabela de Cultos
    `CREATE TABLE IF NOT EXISTS cultos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      igreja_id INT NOT NULL,
      dia_semana VARCHAR(20) NOT NULL,
      hora TIME NOT NULL,
      ativo TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (igreja_id) REFERENCES igrejas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Tabela de Organistas Oficializadas por Igreja
    `CREATE TABLE IF NOT EXISTS organistas_igreja (
      id INT AUTO_INCREMENT PRIMARY KEY,
      organista_id INT NOT NULL,
      igreja_id INT NOT NULL,
      oficializada TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organista_id) REFERENCES organistas(id) ON DELETE CASCADE,
      FOREIGN KEY (igreja_id) REFERENCES igrejas(id) ON DELETE CASCADE,
      UNIQUE KEY unique_organista_igreja (organista_id, igreja_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Tabela de Rodízios
    `CREATE TABLE IF NOT EXISTS rodizios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      igreja_id INT NOT NULL,
      culto_id INT NOT NULL,
      organista_id INT NOT NULL,
      data_culto DATE NOT NULL,
      hora_culto TIME NOT NULL,
      dia_semana VARCHAR(20) NOT NULL,
      funcao ENUM('meia_hora', 'tocar_culto') NOT NULL DEFAULT 'tocar_culto',
      periodo_inicio DATE NOT NULL,
      periodo_fim DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (igreja_id) REFERENCES igrejas(id) ON DELETE CASCADE,
      FOREIGN KEY (culto_id) REFERENCES cultos(id) ON DELETE CASCADE,
      FOREIGN KEY (organista_id) REFERENCES organistas(id) ON DELETE CASCADE,
      UNIQUE KEY unique_rodizio_culto_funcao (culto_id, data_culto, funcao)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Tabela de Histórico de Notificações
    `CREATE TABLE IF NOT EXISTS notificacoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rodizio_id INT NOT NULL,
      tipo VARCHAR(50) NOT NULL,
      enviada TINYINT(1) DEFAULT 0,
      data_envio DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rodizio_id) REFERENCES rodizios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Tabela de Usuários
    `CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      senha_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'usuario') DEFAULT 'usuario',
      ativo TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Tabela de Associação Usuário-Igreja
    `CREATE TABLE IF NOT EXISTS usuario_igreja (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      igreja_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (igreja_id) REFERENCES igrejas(id) ON DELETE CASCADE,
      UNIQUE KEY unique_usuario_igreja (usuario_id, igreja_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  try {
    for (const query of queries) {
      await pool.execute(query);
    }
    console.log('Tabelas criadas com sucesso');
  } catch (error) {
    console.error('Erro ao criar tabelas:', error);
    throw error;
  }
};

// Migração: adicionar coluna funcao se não existir
const migrateRodiziosFuncao = async () => {
  try {
    // Verificar se a coluna já existe
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'rodizios' 
       AND COLUMN_NAME = 'funcao'`
    );
    
    if (columns.length === 0) {
      console.log('🔄 Adicionando coluna funcao na tabela rodizios...');
      
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
          console.error('Erro ao adicionar coluna funcao:', error.message);
          throw error;
        }
      }
      
      // Atualizar rodízios existentes
      try {
        const [updated] = await pool.execute(
          `UPDATE rodizios SET funcao = 'tocar_culto' WHERE funcao IS NULL OR funcao = ''`
        );
        if (updated.affectedRows > 0) {
          console.log(`✅ ${updated.affectedRows} rodízios atualizados com função padrão.`);
        }
      } catch (error) {
        // Ignorar erro se não houver rodízios
        console.log('ℹ️ Nenhum rodízio existente para atualizar.');
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
          console.log('ℹ️ Índice único já existe.');
        } else {
          console.log('⚠️ Aviso ao adicionar índice único:', error.message);
        }
      }
    } else {
      console.log('✅ Coluna funcao já existe na tabela rodizios.');
    }
  } catch (error) {
    console.error('⚠️ Erro na migração da coluna funcao:', error.message);
    // Não falha a inicialização se a migração falhar
  }
};

const getDb = () => {
  if (!pool) {
    throw new Error('Banco de dados não inicializado');
  }
  return pool;
};

const close = async () => {
  if (pool) {
    await pool.end();
    console.log('Conexão com banco de dados fechada');
  }
};

module.exports = {
  init,
  getDb,
  close
};
