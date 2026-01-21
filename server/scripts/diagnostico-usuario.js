const db = require('../database/db');

async function diagnostico() {
  try {
    await db.init();
    const pool = db.getDb();

    console.log('🔍 DIAGNÓSTICO DO SISTEMA\n');
    console.log('='.repeat(60));

    // 1. Verificar usuários sem igreja
    console.log('\n1️⃣ Usuários sem igreja associada:');
    const [usuariosSemIgreja] = await pool.execute(`
      SELECT u.id, u.nome, u.email, u.role, u.aprovado
      FROM usuarios u
      WHERE u.role != 'admin'
      AND u.id NOT IN (SELECT DISTINCT usuario_id FROM usuario_igreja)
    `);
    
    if (usuariosSemIgreja.length > 0) {
      console.log(`   ⚠️  Encontrados ${usuariosSemIgreja.length} usuário(s) sem igreja:`);
      usuariosSemIgreja.forEach(u => {
        console.log(`      - ID: ${u.id} | ${u.nome} (${u.email}) | Aprovado: ${u.aprovado ? 'Sim' : 'Não'}`);
      });
    } else {
      console.log('   ✅ Todos os usuários têm igrejas associadas');
    }

    // 2. Verificar índices
    console.log('\n2️⃣ Verificando índices críticos:');
    const [indexes] = await pool.execute(`
      SELECT 
        TABLE_NAME,
        INDEX_NAME,
        COLUMN_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('usuario_igreja', 'organistas_igreja')
      AND INDEX_NAME != 'PRIMARY'
      ORDER BY TABLE_NAME, INDEX_NAME
    `);
    
    const indexesMap = {};
    indexes.forEach(idx => {
      if (!indexesMap[idx.TABLE_NAME]) {
        indexesMap[idx.TABLE_NAME] = [];
      }
      if (!indexesMap[idx.TABLE_NAME].includes(idx.INDEX_NAME)) {
        indexesMap[idx.TABLE_NAME].push(idx.INDEX_NAME);
      }
    });

    const requiredIndexes = {
      'usuario_igreja': ['idx_usuario_igreja_usuario', 'idx_usuario_igreja_igreja'],
      'organistas_igreja': ['idx_organistas_igreja_organista', 'idx_organistas_igreja_igreja']
    };

    for (const [table, required] of Object.entries(requiredIndexes)) {
      const existing = indexesMap[table] || [];
      const missing = required.filter(idx => !existing.includes(idx));
      
      if (missing.length > 0) {
        console.log(`   ⚠️  ${table}: Faltam índices: ${missing.join(', ')}`);
      } else {
        console.log(`   ✅ ${table}: Todos os índices estão presentes`);
      }
    }

    // 3. Verificar organistas órfãs
    console.log('\n3️⃣ Organistas sem igreja associada:');
    const [organistasOrfas] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM organistas o
      WHERE o.id NOT IN (SELECT DISTINCT organista_id FROM organistas_igreja)
    `);
    
    if (organistasOrfas[0].total > 0) {
      console.log(`   ⚠️  Encontradas ${organistasOrfas[0].total} organista(s) sem igreja associada`);
    } else {
      console.log('   ✅ Todas as organistas têm igrejas associadas');
    }

    // 4. Teste de performance da query getUserIgrejas
    console.log('\n4️⃣ Teste de performance (getUserIgrejas):');
    const [testUsers] = await pool.execute(`
      SELECT id, nome, role
      FROM usuarios
      WHERE role != 'admin'
      LIMIT 5
    `);
    
    for (const user of testUsers) {
      const start = Date.now();
      const [igrejas] = await pool.execute(`
        SELECT i.* 
        FROM igrejas i
        INNER JOIN usuario_igreja ui ON i.id = ui.igreja_id
        WHERE ui.usuario_id = ?
        LIMIT 100
      `, [user.id]);
      const duration = Date.now() - start;
      
      console.log(`   Usuário ${user.id} (${user.nome}): ${igrejas.length} igreja(s) em ${duration}ms`);
      
      if (duration > 1000) {
        console.log(`      ⚠️  Query lenta! Pode indicar falta de índices.`);
      }
    }

    // 5. Verificar pool de conexões
    console.log('\n5️⃣ Status do pool de conexões:');
    const poolInfo = pool.pool || {};
    console.log(`   Connection Limit: ${poolInfo.config?.connectionLimit || 'N/A'}`);
    console.log(`   Queue Limit: ${poolInfo.config?.queueLimit || 'N/A'}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnóstico concluído\n');

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    await db.close();
    process.exit(1);
  }
}

diagnostico();
