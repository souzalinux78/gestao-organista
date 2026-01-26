const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authenticate, isAdmin, getUserIgrejas } = require('../middleware/auth');

// Cadastro público (sem autenticação)
router.post('/register', async (req, res) => {
  try {
    const { nome, email, senha, igreja, tipo_usuario } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    if (!igreja || igreja.trim() === '') {
      return res.status(400).json({ error: 'O campo Igreja/Comum é obrigatório' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
    }

    const pool = db.getDb();
    const dbTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 10000);

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

    // Criar usuário (não aprovado por padrão)
    // Verificar se a coluna tipo_usuario existe
    let temTipoUsuario = false;
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'usuarios' 
        AND COLUMN_NAME = 'tipo_usuario'
      `);
      temTipoUsuario = columns.length > 0;
    } catch (error) {
      // Se der erro, assumir que não existe
      temTipoUsuario = false;
    }
    
    // Validar tipo_usuario se fornecido e se a coluna existe
    let tipoUsuarioValido = null;
    if (temTipoUsuario && tipo_usuario && (tipo_usuario === 'encarregado' || tipo_usuario === 'examinadora')) {
      tipoUsuarioValido = tipo_usuario;
    }
    
    // Montar query dinamicamente baseado na existência da coluna
    let sql, values;
    if (temTipoUsuario) {
      sql = 'INSERT INTO usuarios (nome, email, senha_hash, role, tipo_usuario, aprovado) VALUES (?, ?, ?, ?, ?, ?)';
      values = [nome, email, senhaHash, 'usuario', tipoUsuarioValido, 0];
    } else {
      sql = 'INSERT INTO usuarios (nome, email, senha_hash, role, aprovado) VALUES (?, ?, ?, ?, ?)';
      values = [nome, email, senhaHash, 'usuario', 0];
    }
    
    const [result] = await pool.execute({
      sql: sql,
      values: values,
      timeout: dbTimeout
    });

    const userId = result.insertId;

    // Criar igreja automaticamente com o nome fornecido
    const [igrejaResult] = await pool.execute({
      sql: `INSERT INTO igrejas (
        nome, endereco, 
        encarregado_local_nome, encarregado_local_telefone,
        encarregado_regional_nome, encarregado_regional_telefone,
        mesma_organista_ambas_funcoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values: [
        igreja.trim(),
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

    // Associar usuário à igreja criada
    await pool.execute({
      sql: 'INSERT INTO usuario_igreja (usuario_id, igreja_id) VALUES (?, ?)',
      values: [userId, igrejaId],
      timeout: dbTimeout
    });

    res.status(201).json({
      message: 'Cadastro realizado com sucesso! Aguarde a aprovação do administrador para acessar o sistema.',
      id: userId,
      igreja_id: igrejaId
    });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    
    // Tratar timeout do banco
    if (error.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ error: 'Banco de dados demorou para responder. Tente novamente em instantes.' });
    }
    
    res.status(500).json({ error: 'Erro ao realizar cadastro' });
  }
});

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

    // Verificar se usuário está aprovado (exceto admin que sempre está aprovado)
    if (user.role !== 'admin' && !user.aprovado) {
      return res.status(403).json({ 
        error: 'Sua conta ainda não foi aprovada pelo administrador. Aguarde a aprovação para acessar o sistema.' 
      });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Buscar igrejas do usuário
    const igrejas = await getUserIgrejas(user.id, user.role === 'admin');

    // Gerar token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, tipo_usuario: user.tipo_usuario },
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
        role: user.role,
        tipo_usuario: user.tipo_usuario
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

    // Criar usuário (admin sempre aprova automaticamente)
    const aprovado = role === 'admin' ? 1 : 1; // Admin sempre aprovado, usuários criados por admin também
    const [result] = await pool.execute(
      'INSERT INTO usuarios (nome, email, senha_hash, role, aprovado) VALUES (?, ?, ?, ?, ?)',
      [nome, email, senhaHash, role || 'usuario', aprovado]
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
      `SELECT u.id, u.nome, u.email, u.role, u.ativo, u.aprovado, u.created_at,
              GROUP_CONCAT(i.nome) as igrejas_nomes,
              GROUP_CONCAT(ui.igreja_id) as igrejas_ids
       FROM usuarios u
       LEFT JOIN usuario_igreja ui ON u.id = ui.usuario_id
       LEFT JOIN igrejas i ON ui.igreja_id = i.id
       GROUP BY u.id
       ORDER BY u.aprovado ASC, u.created_at DESC`
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
    const { nome, email, senha, role, ativo, igreja_ids } = req.body;
    const pool = db.getDb();

    // Verificar se usuário existe
    const [users] = await pool.execute('SELECT * FROM usuarios WHERE id = ?', [req.params.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se email já está em uso por outro usuário
    if (email) {
      const [existing] = await pool.execute(
        'SELECT id FROM usuarios WHERE email = ? AND id != ?',
        [email, req.params.id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Email já está em uso por outro usuário' });
      }
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
    if (senha) {
      // Hash da senha antes de atualizar
      const senhaHash = await bcrypt.hash(senha, 10);
      updates.push('senha_hash = ?');
      values.push(senhaHash);
    }
    if (role) {
      updates.push('role = ?');
      values.push(role);
    }
    if (ativo !== undefined) {
      updates.push('ativo = ?');
      values.push(ativo ? 1 : 0);
    }
    if (req.body.aprovado !== undefined) {
      updates.push('aprovado = ?');
      values.push(req.body.aprovado ? 1 : 0);
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

// Aprovar usuário (apenas admin)
router.put('/usuarios/:id/aprovar', authenticate, isAdmin, async (req, res) => {
  try {
    const pool = db.getDb();
    const [result] = await pool.execute(
      'UPDATE usuarios SET aprovado = 1 WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ message: 'Usuário aprovado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rejeitar usuário (apenas admin)
router.put('/usuarios/:id/rejeitar', authenticate, isAdmin, async (req, res) => {
  try {
    const pool = db.getDb();
    const [result] = await pool.execute(
      'UPDATE usuarios SET aprovado = 0 WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ message: 'Usuário rejeitado' });
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

// Migração: associar usuários sem igreja a uma igreja padrão (apenas admin)
router.post('/migrate/usuarios-igrejas', authenticate, isAdmin, async (req, res) => {
  try {
    const pool = db.getDb();
    const dbTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 10000);

    // Identificar usuários que não têm igrejas associadas (exceto admin)
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
      return res.json({ 
        message: 'Todos os usuários já têm igrejas associadas.',
        usuariosCorrigidos: 0,
        organistasAssociadas: 0
      });
    }

    let usuariosCorrigidos = 0;
    let organistasAssociadas = 0;
    const resultados = [];

    // Para cada usuário sem igreja, criar uma igreja padrão e associar
    for (const usuario of usuariosSemIgreja) {
      try {
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

        // Associar usuário à igreja
        await pool.execute({
          sql: 'INSERT INTO usuario_igreja (usuario_id, igreja_id) VALUES (?, ?)',
          values: [usuario.id, igrejaId],
          timeout: dbTimeout
        });

        // Associar organistas "órfãs" à igreja criada
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

        let organistasAssociadasUsuario = 0;
        if (organistasOrfas.length > 0) {
          const placeholders = organistasOrfas.map(() => '(?, ?, ?)').join(', ');
          const params = organistasOrfas.flatMap((org) => [org.id, igrejaId, org.oficializada]);

          await pool.execute({
            sql: `INSERT IGNORE INTO organistas_igreja (organista_id, igreja_id, oficializada) VALUES ${placeholders}`,
            values: params,
            timeout: dbTimeout
          });

          organistasAssociadasUsuario = organistasOrfas.length;
          organistasAssociadas += organistasAssociadasUsuario;
        }

        usuariosCorrigidos++;
        resultados.push({
          usuario: usuario.nome,
          igreja: nomeIgreja,
          organistasAssociadas: organistasAssociadasUsuario
        });

      } catch (error) {
        resultados.push({
          usuario: usuario.nome,
          erro: error.message
        });
      }
    }

    res.json({
      message: `Migração concluída: ${usuariosCorrigidos} usuário(s) corrigido(s)`,
      usuariosCorrigidos,
      organistasAssociadas,
      resultados
    });
  } catch (error) {
    console.error('Erro na migração:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
