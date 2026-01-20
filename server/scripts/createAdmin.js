const bcrypt = require('bcryptjs');
const db = require('../database/db');

async function createAdmin() {
  try {
    await db.init();
    const pool = db.getDb();
    
    // Verificar se já existe admin
    const [existing] = await pool.execute(
      "SELECT id FROM usuarios WHERE email = 'admin@gestao.com'"
    );
    
    if (existing.length > 0) {
      console.log('Admin já existe!');
      process.exit(0);
    }
    
    // Criar admin padrão
    const senhaHash = await bcrypt.hash('admin123', 10);
    
    const [result] = await pool.execute(
      'INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)',
      ['Administrador', 'admin@gestao.com', senhaHash, 'admin']
    );
    
    console.log('✅ Admin criado com sucesso!');
    console.log('Email: admin@gestao.com');
    console.log('Senha: admin123');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
    
    process.exit(0);
  } catch (error) {
    console.error('Erro ao criar admin:', error);
    process.exit(1);
  }
}

createAdmin();
