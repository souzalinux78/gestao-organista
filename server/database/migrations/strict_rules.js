const mysql = require('mysql2/promise');
const { getDb } = require('../db');

const migrateStrictRules = async () => {
  const pool = getDb();
  console.log('🚀 Iniciando migração para Regras Estritas (V2)...');

  try {
    // 1. Criar tabela `ciclos`
    // Tabela para nomes dinâmicos de ciclos (ex: "Cultos", "RJM")
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ciclos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        igreja_id INT NOT NULL,
        nome VARCHAR(100) NOT NULL,
        ordem INT NOT NULL DEFAULT 1,
        ativo TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (igreja_id) REFERENCES igrejas(id) ON DELETE CASCADE,
        UNIQUE KEY unique_ciclo_igreja_nome (igreja_id, nome)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabela `ciclos` criada.');

    // 2. Modificar tabela `organistas`
    // Adicionar categoria (Oficial, RJM, Aluna)
    // Se já existir, modificar enum
    const [colsOrg] = await pool.execute(`SHOW COLUMNS FROM organistas LIKE 'categoria'`);
    if (colsOrg.length === 0) {
      await pool.execute(`
        ALTER TABLE organistas 
        ADD COLUMN categoria ENUM('oficial', 'rjm', 'aluna') NOT NULL DEFAULT 'oficial' 
        AFTER oficializada
      `);
      console.log('✅ Coluna `categoria` adicionada em `organistas`.');
      
      // Migrar dados existentes: oficializada=0 -> aluna
      await pool.execute(`UPDATE organistas SET categoria = 'aluna' WHERE oficializada = 0`);
      console.log('🔄 Dados de organistas migrados (Alunas).');
    }

    // 3. Modificar tabela `cultos`
    // Adicionar tipo (Culto Oficial, RJM, Outro)
    const [colsCulto] = await pool.execute(`SHOW COLUMNS FROM cultos LIKE 'tipo'`);
    if (colsCulto.length === 0) {
      await pool.execute(`
        ALTER TABLE cultos 
        ADD COLUMN tipo ENUM('culto_oficial', 'rjm', 'outro') NOT NULL DEFAULT 'culto_oficial' 
        AFTER hora
      `);
      console.log('✅ Coluna `tipo` adicionada em `cultos`.');
    }

    // 4. Modificar tabela `ciclo_itens`
    // Adicionar ciclo_id (FK para tabela ciclos)
    const [colsCicloItens] = await pool.execute(`SHOW COLUMNS FROM ciclo_itens LIKE 'ciclo_id'`);
    if (colsCicloItens.length === 0) {
      await pool.execute(`
        ALTER TABLE ciclo_itens 
        ADD COLUMN ciclo_id INT NULL AFTER igreja_id,
        ADD FOREIGN KEY (ciclo_id) REFERENCES ciclos(id) ON DELETE CASCADE
      `);
      console.log('✅ Coluna `ciclo_id` adicionada em `ciclo_itens`.');
    }

    // 5. Migrar dados de Ciclos (Converter número 1,2,3... em registros na tabela ciclos)
    // Pegar todas as igrejas e criar ciclos padrão se não existirem
    const [igrejas] = await pool.execute('SELECT id FROM igrejas');
    
    for (const igreja of igrejas) {
      // Verificar se já tem ciclos
      const [ciclosExistentes] = await pool.execute('SELECT * FROM ciclos WHERE igreja_id = ?', [igreja.id]);
      
      if (ciclosExistentes.length === 0) {
        // Criar ciclos padrão: 1=Cultos, 2=Cultos (fds), 3=Outro (conforme uso antigo 1,2,3)
        // Mas a regra diz: "Nomes obrigatorios para rodizio: Cultos, RJM"
        // Vamos criar esses dois iniciais.
        
        // Ciclo 1: Cultos
        const [res1] = await pool.execute(
          'INSERT INTO ciclos (igreja_id, nome, ordem) VALUES (?, ?, ?)',
          [igreja.id, 'Cultos', 1]
        );
        const idCultos = res1.insertId;
        
        // Ciclo 2: RJM
        const [res2] = await pool.execute(
          'INSERT INTO ciclos (igreja_id, nome, ordem) VALUES (?, ?, ?)',
          [igreja.id, 'RJM', 2]
        );
        const idRJM = res2.insertId;

        console.log(`🔄 Ciclos padrão criados para igreja ${igreja.id}: Cultos e RJM.`);

        // Tentar migrar itens existentes em ciclo_itens
        // O sistema antigo usava numero_ciclo (1, 2, 3...)
        // Vamos assumir que "1" e "2" vão para "Cultos" e talvez criar novos se tiver mais.
        // PELA REGRA DO CLIENTE: O usuario cadastra. Vamos deixar 1->Cultos, 2->RJM por enquanto como placeholder.
        
        await pool.execute('UPDATE ciclo_itens SET ciclo_id = ? WHERE igreja_id = ? AND numero_ciclo = 1', [idCultos, igreja.id]);
        await pool.execute('UPDATE ciclo_itens SET ciclo_id = ? WHERE igreja_id = ? AND numero_ciclo = 2', [idRJM, igreja.id]);
        
        // Se tiver numero_ciclo 3, 4 etc, movemos para Cultos por segurança ou criamos "Ciclo 3"
        await pool.execute('UPDATE ciclo_itens SET ciclo_id = ? WHERE igreja_id = ? AND ciclo_id IS NULL', [idCultos, igreja.id]);
      }
    }

    console.log('🏁 Migração de Regras Estritas concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    throw error;
  }
};

module.exports = migrateStrictRules;
