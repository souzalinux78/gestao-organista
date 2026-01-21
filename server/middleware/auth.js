const jwt = require('jsonwebtoken');
const db = require('../database/db');

// Middleware de autenticação
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.session?.token;

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua-chave-secreta-aqui');
    
    // Buscar usuário no banco
    const pool = db.getDb();
    const [users] = await pool.execute({
      sql: 'SELECT id, nome, email, role, ativo, aprovado FROM usuarios WHERE id = ?',
      values: [decoded.userId],
      timeout: Number(process.env.DB_QUERY_TIMEOUT_MS || 10000)
    });

    if (users.length === 0 || !users[0].ativo) {
      return res.status(401).json({ error: 'Usuário inválido ou inativo' });
    }

    // Verificar se usuário está aprovado (exceto admin que sempre está aprovado)
    if (users[0].role !== 'admin' && !users[0].aprovado) {
      return res.status(403).json({ 
        error: 'Sua conta ainda não foi aprovada pelo administrador. Aguarde a aprovação para acessar o sistema.' 
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware para verificar se é admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
  next();
};

// Middleware para verificar acesso à igreja
const checkIgrejaAccess = async (req, res, next) => {
  try {
    // Admin tem acesso a todas as igrejas
    if (req.user.role === 'admin') {
      return next();
    }

    const igrejaId = req.params.igreja_id || req.body.igreja_id || req.query.igreja_id;
    
    if (!igrejaId) {
      return res.status(400).json({ error: 'ID da igreja não fornecido' });
    }

    const pool = db.getDb();
    const [associations] = await pool.execute(
      'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
      [req.user.id, igrejaId]
    );

    if (associations.length === 0) {
      return res.status(403).json({ error: 'Acesso negado a esta igreja' });
    }

    req.userIgrejaId = parseInt(igrejaId);
    next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Função auxiliar para obter igrejas do usuário
const getUserIgrejas = async (userId, isAdmin) => {
  const pool = db.getDb();
  const dbTimeout = Number(process.env.DB_QUERY_TIMEOUT_MS || 8000); // Reduzido para 8s
  
  try {
    if (isAdmin) {
      const [igrejas] = await pool.execute({
        sql: 'SELECT * FROM igrejas ORDER BY nome',
        timeout: dbTimeout
      });
      return igrejas || [];
    } else {
      // Query otimizada com índice em usuario_igreja.usuario_id
      const [igrejas] = await pool.execute({
        sql: `SELECT i.* 
              FROM igrejas i
              INNER JOIN usuario_igreja ui ON i.id = ui.igreja_id
              WHERE ui.usuario_id = ?
              ORDER BY i.nome
              LIMIT 100`,
        values: [userId],
        timeout: dbTimeout
      });
      return igrejas || [];
    }
  } catch (error) {
    console.error(`[DEBUG] Erro em getUserIgrejas para usuário ${userId}:`, error.message);
    // Retornar array vazio em caso de erro para não quebrar o fluxo
    return [];
  }
};

module.exports = {
  authenticate,
  isAdmin,
  checkIgrejaAccess,
  getUserIgrejas
};
