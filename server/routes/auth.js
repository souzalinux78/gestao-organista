const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authenticate, isAdmin, getUserIgrejas } = require('../middleware/auth');
const { getConfig } = require('../config/env');
const { validate, schemas } = require('../middleware/validation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Função para enviar webhook de novo cadastro
const enviarWebhookCadastro = async (dadosUsuario) => {
  try {
    const pool = db.getDb();
    
    // Buscar webhook configurado
    const [config] = await pool.execute(
      'SELECT valor FROM configuracoes WHERE chave = ?',
      ['webhook_cadastro']
    );
    
    const webhookUrl = config.length > 0 ? config[0].valor : null;
    
    if (!webhookUrl) {
      console.log('[WEBHOOK CADASTRO] Webhook não configurado, pulando envio');
      return;
    }
    
    const axios = require('axios');
    const payload = {
      tipo: 'novo_cadastro',
      timestamp: new Date().toISOString(),
      timestamp_br: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      usuario: {
        id: dadosUsuario.id,
        nome: dadosUsuario.nome,
        email: dadosUsuario.email,
        telefone: dadosUsuario.telefone || null,
        tipo_usuario: dadosUsuario.tipo_usuario || null,
        igreja: dadosUsuario.igreja || null,
        igreja_id: dadosUsuario.igreja_id || null,
        aprovado: false,
        created_at: dadosUsuario.created_at || new Date().toISOString()
      },
      mensagem: `Novo cadastro: ${dadosUsuario.nome} (${dadosUsuario.email}) aguardando aprovação`
    };
    
    await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`✅ [WEBHOOK CADASTRO] Enviado com sucesso para: ${webhookUrl}`);
  } catch (error) {
    console.error('[WEBHOOK CADASTRO] Erro ao enviar webhook:', error.message);
    // Não falha o cadastro se o webhook falhar
  }
};

// Função para enviar webhook quando um usuário for aprovado (admin)
// Reutiliza a configuração "webhook_cadastro" (mesmo endpoint) para centralizar integrações.
const enviarWebhookAprovacao = async ({ aprovadoPor, usuario, igrejas }) => {
  try {
    const pool = db.getDb();

    const [config] = await pool.execute(
      'SELECT valor FROM configuracoes WHERE chave = ?',
      ['webhook_cadastro']
    );

    const webhookUrl = config.length > 0 ? config[0].valor : null;
    if (!webhookUrl) {
      console.log('[WEBHOOK APROVACAO] Webhook não configurado, pulando envio');
      return;
    }

    const axios = require('axios');
    const payload = {
      tipo: 'usuario_aprovado',
      timestamp: new Date().toISOString(),
      timestamp_br: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      aprovado_por: {
        id: aprovadoPor?.id || null,
        nome: aprovadoPor?.nome || null,
        email: aprovadoPor?.email || null
      },
      usuario: usuario || null,
      igrejas: Array.isArray(igrejas) ? igrejas : [],
      mensagem: usuario?.nome
        ? `Usuário aprovado: ${usuario.nome} (${usuario.email || 'sem email'})`
        : 'Usuário aprovado pelo administrador'
    };

    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log(`✅ [WEBHOOK APROVACAO] Enviado com sucesso para: ${webhookUrl}`);
  } catch (error) {
    console.error('[WEBHOOK APROVACAO] Erro ao enviar webhook:', error.message);
    // Não falha a aprovação se o webhook falhar
  }
};

// Cadastro público (sem autenticação)
router.post('/register', async (req, res) => {
  try {
    const { nome, email, senha, igreja, tipo_usuario, telefone } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    if (!telefone || telefone.trim() === '') {
      return res.status(400).json({ error: 'O campo Celular é obrigatório para aprovação' });
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

    // Obter tenant padrão para novos usuários
    const [tenants] = await pool.execute(
      'SELECT id FROM tenants WHERE slug = ? LIMIT 1',
      ['default']
    );
    const defaultTenantId = tenants.length > 0 ? tenants[0].id : null;

    // Criar usuário (não aprovado por padrão)
    // Verificar se a coluna tipo_usuario existe (com cache)
    const { cachedColumnExists } = require('../utils/cache');
    const temTipoUsuario = await cachedColumnExists('usuarios', 'tipo_usuario');
    
    // Validar tipo_usuario se fornecido e se a coluna existe
    let tipoUsuarioValido = null;
    if (temTipoUsuario && tipo_usuario && (tipo_usuario === 'encarregado' || tipo_usuario === 'examinadora' || tipo_usuario === 'instrutoras')) {
      tipoUsuarioValido = tipo_usuario;
    }
    
    // Verificar se tenant_id existe na tabela
    const temTenantId = await cachedColumnExists('usuarios', 'tenant_id');
    const temTelefone = await cachedColumnExists('usuarios', 'telefone');
    
    // Montar query dinamicamente baseado na existência das colunas
    let sql, values;
    if (temTipoUsuario && temTenantId && temTelefone && defaultTenantId) {
      sql = 'INSERT INTO usuarios (nome, email, telefone, senha_hash, role, tipo_usuario, tenant_id, aprovado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      values = [nome, email, telefone.trim(), senhaHash, 'usuario', tipoUsuarioValido, defaultTenantId, 0];
    } else if (temTipoUsuario && temTelefone) {
      sql = 'INSERT INTO usuarios (nome, email, telefone, senha_hash, role, tipo_usuario, aprovado) VALUES (?, ?, ?, ?, ?, ?, ?)';
      values = [nome, email, telefone.trim(), senhaHash, 'usuario', tipoUsuarioValido, 0];
    } else if (temTenantId && temTelefone && defaultTenantId) {
      sql = 'INSERT INTO usuarios (nome, email, telefone, senha_hash, role, tenant_id, aprovado) VALUES (?, ?, ?, ?, ?, ?, ?)';
      values = [nome, email, telefone.trim(), senhaHash, 'usuario', defaultTenantId, 0];
    } else if (temTelefone) {
      sql = 'INSERT INTO usuarios (nome, email, telefone, senha_hash, role, aprovado) VALUES (?, ?, ?, ?, ?, ?)';
      values = [nome, email, telefone.trim(), senhaHash, 'usuario', 0];
    } else if (temTipoUsuario && temTenantId && defaultTenantId) {
      sql = 'INSERT INTO usuarios (nome, email, senha_hash, role, tipo_usuario, tenant_id, aprovado) VALUES (?, ?, ?, ?, ?, ?, ?)';
      values = [nome, email, senhaHash, 'usuario', tipoUsuarioValido, defaultTenantId, 0];
    } else if (temTipoUsuario) {
      sql = 'INSERT INTO usuarios (nome, email, senha_hash, role, tipo_usuario, aprovado) VALUES (?, ?, ?, ?, ?, ?)';
      values = [nome, email, senhaHash, 'usuario', tipoUsuarioValido, 0];
    } else if (temTenantId && defaultTenantId) {
      sql = 'INSERT INTO usuarios (nome, email, senha_hash, role, tenant_id, aprovado) VALUES (?, ?, ?, ?, ?, ?)';
      values = [nome, email, senhaHash, 'usuario', defaultTenantId, 0];
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
    // IMPORTANTE: em produção (FASE 5 multi-tenant), tenant_id pode ser NOT NULL.
    // Então, se a coluna existir, SEMPRE inserir com tenant_id para não falhar o INSERT.
    const igrejasTemTenantId = await cachedColumnExists('igrejas', 'tenant_id');
    
    // Garantir que temos um tenant_id válido se a coluna existir
    let tenantIdParaIgreja = defaultTenantId;
    if (igrejasTemTenantId && !tenantIdParaIgreja) {
      // Se a coluna existe mas não temos tenant, buscar novamente
      const [tenantsRetry] = await pool.execute(
        'SELECT id FROM tenants WHERE slug = ? LIMIT 1',
        ['default']
      );
      tenantIdParaIgreja = tenantsRetry.length > 0 ? tenantsRetry[0].id : null;
      
      if (!tenantIdParaIgreja) {
        return res.status(500).json({ 
          error: 'Erro interno: tenant padrão não encontrado. Contate o administrador.' 
        });
      }
    }

    const igrejaInsert = igrejasTemTenantId
      ? {
          sql: `INSERT INTO igrejas (
            nome, endereco,
            encarregado_local_nome, encarregado_local_telefone,
            encarregado_regional_nome, encarregado_regional_telefone,
            mesma_organista_ambas_funcoes,
            tenant_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            igreja.trim(),
            null,
            null,
            null,
            null,
            null,
            0,
            tenantIdParaIgreja
          ]
        }
      : {
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
          ]
        };

    const [igrejaResult] = await pool.execute({
      sql: igrejaInsert.sql,
      values: igrejaInsert.values,
      timeout: dbTimeout
    });

    const igrejaId = igrejaResult.insertId;

    // Associar usuário à igreja criada
    await pool.execute({
      sql: 'INSERT INTO usuario_igreja (usuario_id, igreja_id) VALUES (?, ?)',
      values: [userId, igrejaId],
      timeout: dbTimeout
    });

    // Enviar webhook de novo cadastro (não bloqueia a resposta)
    enviarWebhookCadastro({
      id: userId,
      nome,
      email,
      telefone: telefone ? telefone.trim() : null,
      tipo_usuario: tipoUsuarioValido,
      igreja: igreja.trim(),
      igreja_id: igrejaId,
      created_at: new Date().toISOString()
    }).catch(err => {
      console.error('Erro ao enviar webhook de cadastro:', err);
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

// Login (com validação e errorHandler)
router.post('/login', validate(schemas.login), asyncHandler(async (req, res) => {
  const { email, senha } = req.body; // Já validado e sanitizado

  const pool = db.getDb();
  const [users] = await pool.execute(
    'SELECT * FROM usuarios WHERE email = ?',
    [email]
  );

  if (users.length === 0) {
    throw new AppError('Email ou senha inválidos', 401, 'INVALID_CREDENTIALS');
  }

  const user = users[0];

  if (!user.ativo) {
    throw new AppError('Usuário inativo', 401, 'USER_INACTIVE');
  }

  // Verificar se usuário está aprovado (exceto admin que sempre está aprovado)
  if (user.role !== 'admin' && !user.aprovado) {
    throw new AppError(
      'Sua conta ainda não foi aprovada pelo administrador. Aguarde a aprovação para acessar o sistema.',
      403,
      'USER_NOT_APPROVED'
    );
  }

  const senhaValida = await bcrypt.compare(senha, user.senha_hash);

  if (!senhaValida) {
    throw new AppError('Email ou senha inválidos', 401, 'INVALID_CREDENTIALS');
  }

  // Buscar igrejas do usuário (com tenant_id se disponível)
  const tenantId = user.tenant_id || null;
  const igrejas = await getUserIgrejas(user.id, user.role === 'admin', tenantId);

  // Gerar token com JWT_SECRET validado
  // Reduzido de 7d para 1d para melhor segurança (token comprometido válido por menos tempo)
  // Incluir tenant_id no token para resolução rápida
  const envConfig = getConfig();
  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role, 
      tipo_usuario: user.tipo_usuario,
      tenantId: user.tenant_id || null // Adicionar tenant_id ao JWT
    },
    envConfig.JWT_SECRET,
    { expiresIn: '1d' } // Reduzido de 7d para 1d
  );

  // Remover senha_hash da resposta
  delete user.senha_hash;

  logger.info('Login realizado com sucesso', { userId: user.id, email: user.email });

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
}));

// Verificar token (usado pelo frontend)
router.get('/me', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.tenantId || null;
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    
    res.json({
      user: {
        id: req.user.id,
        nome: req.user.nome,
        email: req.user.email,
        role: req.user.role,
        tenant_id: req.user.tenant_id || req.user.tenantId || null
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

    // Obter tenant do admin que está criando (ou tenant padrão)
    const adminTenantId = req.user.tenant_id || req.user.tenantId || null;
    
    // Se admin não tem tenant (acesso global), usar tenant padrão para novos usuários
    const [tenants] = await pool.execute(
      'SELECT id FROM tenants WHERE slug = ? LIMIT 1',
      ['default']
    );
    const defaultTenantId = tenants.length > 0 ? tenants[0].id : null;
    const tenantIdParaNovoUsuario = adminTenantId || defaultTenantId;
    
    // Verificar se tenant_id existe na tabela
    const { cachedColumnExists } = require('../utils/cache');
    const temTenantId = await cachedColumnExists('usuarios', 'tenant_id');
    
    // Criar usuário (admin sempre aprova automaticamente)
    const aprovado = role === 'admin' ? 1 : 1; // Admin sempre aprovado, usuários criados por admin também
    
    let sql, values;
    if (temTenantId && tenantIdParaNovoUsuario) {
      sql = 'INSERT INTO usuarios (nome, email, senha_hash, role, tenant_id, aprovado) VALUES (?, ?, ?, ?, ?, ?)';
      values = [nome, email, senhaHash, role || 'usuario', tenantIdParaNovoUsuario, aprovado];
    } else {
      sql = 'INSERT INTO usuarios (nome, email, senha_hash, role, aprovado) VALUES (?, ?, ?, ?, ?)';
      values = [nome, email, senhaHash, role || 'usuario', aprovado];
    }
    
    const [result] = await pool.execute(sql, values);

    const userId = result.insertId;

    // Associar usuário às igrejas se fornecido (paralelizado)
    if (igreja_ids && Array.isArray(igreja_ids) && igreja_ids.length > 0) {
      // Usar Promise.all para paralelizar inserts
      await Promise.all(
        igreja_ids.map(igrejaId =>
          pool.execute(
            'INSERT IGNORE INTO usuario_igreja (usuario_id, igreja_id) VALUES (?, ?)',
            [userId, igrejaId]
          )
        )
      );
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

      // Adicionar novas associações (paralelizado)
      if (Array.isArray(igreja_ids) && igreja_ids.length > 0) {
        await Promise.all(
          igreja_ids.map(igrejaId =>
            pool.execute(
              'INSERT INTO usuario_igreja (usuario_id, igreja_id) VALUES (?, ?)',
              [req.params.id, igrejaId]
            )
          )
        );
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
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'ID do usuário inválido' });
    }
    const [result] = await pool.execute(
      'UPDATE usuarios SET aprovado = 1 WHERE id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Buscar dados do usuário aprovado + igrejas para enviar webhook (não bloqueia a resposta)
    try {
      const { cachedColumnExists } = require('../utils/cache');
      const temTipoUsuario = await cachedColumnExists('usuarios', 'tipo_usuario');
      const temTelefone = await cachedColumnExists('usuarios', 'telefone');

      const selectExtra = [
        temTipoUsuario ? 'u.tipo_usuario' : 'NULL as tipo_usuario',
        temTelefone ? 'u.telefone' : 'NULL as telefone'
      ].join(', ');

      const [rows] = await pool.execute(
        `SELECT u.id, u.nome, u.email, u.role, u.ativo, u.aprovado, u.created_at, ${selectExtra},
                GROUP_CONCAT(i.nome) as igrejas_nomes,
                GROUP_CONCAT(ui.igreja_id) as igrejas_ids
         FROM usuarios u
         LEFT JOIN usuario_igreja ui ON u.id = ui.usuario_id
         LEFT JOIN igrejas i ON ui.igreja_id = i.id
         WHERE u.id = ?
         GROUP BY u.id
         LIMIT 1`,
        [userId]
      );

      if (rows.length > 0) {
        const u = rows[0];
        const ids = u.igrejas_ids ? u.igrejas_ids.split(',') : [];
        const nomes = u.igrejas_nomes ? u.igrejas_nomes.split(',') : [];
        const igrejas = ids
          .map((id, idx) => ({ id: Number(id), nome: nomes[idx] || null }))
          .filter(x => Number.isFinite(x.id));

        enviarWebhookAprovacao({
          aprovadoPor: { id: req.user?.id, nome: req.user?.nome, email: req.user?.email },
          usuario: {
            id: u.id,
            nome: u.nome,
            email: u.email,
            telefone: u.telefone || null,
            tipo_usuario: u.tipo_usuario || null,
            role: u.role,
            ativo: !!u.ativo,
            aprovado: true,
            created_at: u.created_at
          },
          igrejas
        }).catch(() => {});
      }
    } catch (webhookErr) {
      console.warn('⚠️  Aviso ao preparar/enviar webhook de aprovação:', webhookErr.message);
    }

    res.json({ message: 'Usuário aprovado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao aprovar usuário' });
  }
});

// Rejeitar usuário (apenas admin)
router.put('/usuarios/:id/rejeitar', authenticate, isAdmin, async (req, res) => {
  try {
    const pool = db.getDb();
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'ID do usuário inválido' });
    }
    const [result] = await pool.execute(
      'UPDATE usuarios SET aprovado = 0 WHERE id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ message: 'Usuário rejeitado' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao rejeitar usuário' });
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

    // Verificar se igrejas têm tenant_id e obter tenant padrão
    const { cachedColumnExists } = require('../utils/cache');
    const igrejasTemTenantId = await cachedColumnExists('igrejas', 'tenant_id');
    let defaultTenantId = null;
    if (igrejasTemTenantId) {
      const [tenants] = await pool.execute(
        'SELECT id FROM tenants WHERE slug = ? LIMIT 1',
        ['default']
      );
      defaultTenantId = tenants.length > 0 ? tenants[0].id : null;
      if (!defaultTenantId) {
        return res.status(500).json({ 
          error: 'Erro interno: tenant padrão não encontrado. Contate o administrador.' 
        });
      }
    }

    // Para cada usuário sem igreja, criar uma igreja padrão e associar
    for (const usuario of usuariosSemIgreja) {
      try {
        // Criar igreja padrão com nome baseado no usuário
        const nomeIgreja = `${usuario.nome} - Igreja`;
        
        const igrejaInsert = igrejasTemTenantId
          ? {
              sql: `INSERT INTO igrejas (
                nome, endereco, 
                encarregado_local_nome, encarregado_local_telefone,
                encarregado_regional_nome, encarregado_regional_telefone,
                mesma_organista_ambas_funcoes,
                tenant_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              values: [
                nomeIgreja,
                null,
                null,
                null,
                null,
                null,
                0,
                defaultTenantId
              ]
            }
          : {
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
              ]
            };
        
        const [igrejaResult] = await pool.execute({
          sql: igrejaInsert.sql,
          values: igrejaInsert.values,
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
