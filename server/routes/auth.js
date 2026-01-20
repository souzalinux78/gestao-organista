const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authenticate, isAdmin, getUserIgrejas } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const pool = db.getDb();
    const [users] = await pool.execute(
      'SELECT * FROM usuarios WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const user = users[0];

    if (!user.ativo) {
      return res.status(401).json({ error: 'Usuário inativo' });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Buscar igrejas do usuário
    const igrejas = await getUserIgrejas(user.id, user.role === 'admin');

    // Gerar token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'sua-chave-secreta-aqui',
      { expiresIn: '7d' }
    );

    // Remover senha_hash da resposta
    delete user.senha_hash;

    res.json({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role
      },
      igrejas
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Verificar token (usado pelo frontend)
router.get('/me', authenticate, async (req, res) => {
  try {
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin');
    
    res.json({
      user: {
        id: req.user.id,
        nome: req.user.nome,
        email: req.user.email,
        role: req.user.role
      },
      igrejas
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar usuário (apenas admin)
router.post('/usuarios', authenticate, isAdmin, async (req, res) => {
  try {
    const { nome, email, senha, role, igreja_ids } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    const pool = db.getDb();

    // Verificar se email já existe
    const [existing] = await pool.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar usuário
    const [result] = await pool.execute(
      'INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)',
      [nome, email, senhaHash, role || 'usuario']
    );

    const userId = result.insertId;

    // Associar usuário às igrejas se fornecido
    if (igreja_ids && Array.isArray(igreja_ids) && igreja_ids.length > 0) {
      for (const igrejaId of igreja_ids) {
        await pool.execute(
          'INSERT IGNORE INTO usuario_igreja (usuario_id, igreja_id) VALUES (?, ?)',
          [userId, igrejaId]
        );
      }
    }

    res.json({
      id: userId,
      nome,
      email,
      role: role || 'usuario',
      message: 'Usuário criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Listar usuários (apenas admin)
router.get('/usuarios', authenticate, isAdmin, async (req, res) => {
  try {
    const pool = db.getDb();
    const [users] = await pool.execute(
      `SELECT u.id, u.nome, u.email, u.role, u.ativo, u.created_at,
              GROUP_CONCAT(i.nome) as igrejas_nomes,
              GROUP_CONCAT(ui.igreja_id) as igrejas_ids
       FROM usuarios u
       LEFT JOIN usuario_igreja ui ON u.id = ui.usuario_id
       LEFT JOIN igrejas i ON ui.igreja_id = i.id
       GROUP BY u.id
       ORDER BY u.nome`
    );

    const usuarios = users.map(user => ({
      ...user,
      igrejas_ids: user.igrejas_ids ? user.igrejas_ids.split(',').map(Number) : [],
      igrejas_nomes: user.igrejas_nomes || ''
    }));

    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar usuário (apenas admin)
router.put('/usuarios/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { nome, email, role, ativo, igreja_ids } = req.body;
    const pool = db.getDb();

    // Verificar se usuário existe
    const [users] = await pool.execute('SELECT * FROM usuarios WHERE id = ?', [req.params.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Atualizar dados do usuário
    const updates = [];
    const values = [];

    if (nome) {
      updates.push('nome = ?');
      values.push(nome);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (role) {
      updates.push('role = ?');
      values.push(role);
    }
    if (ativo !== undefined) {
      updates.push('ativo = ?');
      values.push(ativo ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(req.params.id);
      await pool.execute(
        `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Atualizar associações com igrejas
    if (igreja_ids !== undefined) {
      // Remover associações existentes
      await pool.execute('DELETE FROM usuario_igreja WHERE usuario_id = ?', [req.params.id]);

      // Adicionar novas associações
      if (Array.isArray(igreja_ids) && igreja_ids.length > 0) {
        for (const igrejaId of igreja_ids) {
          await pool.execute(
            'INSERT INTO usuario_igreja (usuario_id, igreja_id) VALUES (?, ?)',
            [req.params.id, igrejaId]
          );
        }
      }
    }

    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar usuário (apenas admin)
router.delete('/usuarios/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const pool = db.getDb();
    const [result] = await pool.execute('DELETE FROM usuarios WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
