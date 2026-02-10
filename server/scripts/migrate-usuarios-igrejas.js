const db = require('../database/db');

async function migrate() {
  try {
    await db.init();
    const pool = db.getDb();
    const dbTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 10000);

    console.log('🔄 Iniciando migração: associar usuários sem igreja a uma igreja padrão...\n');

    // 1. Identificar usuários que não têm igrejas associadas (exceto admin)
    const [usuariosSemIgreja] = await pool.execute({
      sql: `
        SELECT u.id, u.nome, u.email, u.role
        FROM usuarios u
        WHERE u.role != 'admin'
        AND u.id NOT IN (
          SELECT DISTINCT usuario_id 
          FROM usuario_igreja
        )
        ORDER BY u.id
      `,
      timeout: dbTimeout
    });

    if (usuariosSemIgreja.length === 0) {
      console.log('✅ Todos os usuários já têm igrejas associadas.');
      await db.close();
      process.exit(0);
    }

    console.log(`📋 Encontrados ${usuariosSemIgreja.length} usuário(s) sem igreja associada:\n`);

    let usuariosCorrigidos = 0;
    let organistasAssociadas = 0;

    // 2. Para cada usuário sem igreja, criar uma igreja padrão e associar
    for (const usuario of usuariosSemIgreja) {
      try {
        console.log(`  🔧 Processando usuário: ${usuario.nome} (ID: ${usuario.id})`);

        // Criar igreja padrão com nome baseado no usuário
        const nomeIgreja = `${usuario.nome} - Igreja`;
        
        const [igrejaResult] = await pool.execute({
          sql: `INSERT INTO igrejas (
            nome, endereco, 
            encarregado_local_nome, encarregado_local_telefone,
            encarregado_regional_nome, encarregado_regional_telefone,
            mesma_organista_ambas_funcoes
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          values: [
            nomeIgreja,
            null,
            null,
            null,
            null,
            null,
            0
          ],
          timeout: dbTimeout
        });

        const igrejaId = igrejaResult.insertId;
        console.log(`    ✅ Igreja criada: "${nomeIgreja}" (ID: ${igrejaId})`);

        // Associar usuário à igreja
        await pool.execute({
          sql: 'INSERT INTO usuario_igreja (usuario_id, igreja_id) VALUES (?, ?)',
          values: [usuario.id, igrejaId],
          timeout: dbTimeout
        });
        console.log(`    ✅ Usuário associado à igreja`);

        // 3. Associar organistas "órfãs" (que não estão associadas a nenhuma igreja) à igreja criada
        const [organistasOrfas] = await pool.execute({
          sql: `
            SELECT o.id, o.oficializada
            FROM organistas o
            WHERE o.id NOT IN (SELECT DISTINCT organista_id FROM organistas_igreja)
            ORDER BY o.id DESC
            LIMIT 100
          `,
          timeout: dbTimeout
        });

        if (organistasOrfas.length > 0) {
          const placeholders = organistasOrfas.map(() => '(?, ?, ?)').join(', ');
          const params = organistasOrfas.flatMap((org) => [org.id, igrejaId, org.oficializada]);

          await pool.execute({
            sql: `INSERT IGNORE INTO organistas_igreja (organista_id, igreja_id, oficializada) VALUES ${placeholders}`,
            values: params,
            timeout: dbTimeout
          });

          console.log(`    ✅ ${organistasOrfas.length} organista(s) "órfã(s)" associada(s) à igreja`);
          organistasAssociadas += organistasOrfas.length;
        }

        usuariosCorrigidos++;
        console.log('');

      } catch (error) {
        console.error(`    ❌ Erro ao processar usuário ${usuario.nome} (ID: ${usuario.id}):`, error.message);
      }
    }

    console.log('\n📊 Resumo da migração:');
    console.log(`   ✅ ${usuariosCorrigidos} usuário(s) corrigido(s)`);
    console.log(`   ✅ ${organistasAssociadas} organista(s) associada(s)`);
    console.log('\n✅ Migração concluída com sucesso!');

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    await db.close();
    process.exit(1);
  }
}

migrate();
