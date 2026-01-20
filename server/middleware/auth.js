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
    const [users] = await pool.execute(
      'SELECT id, nome, email, role, ativo FROM usuarios WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0 || !users[0].ativo) {
      return res.status(401).json({ error: 'Usuário inválido ou inativo' });
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
  
  if (isAdmin) {
    const [igrejas] = await pool.execute('SELECT * FROM igrejas ORDER BY nome');
    return igrejas;
  } else {
    const [igrejas] = await pool.execute(
      `SELECT i.* FROM igrejas i
       INNER JOIN usuario_igreja ui ON i.id = ui.igreja_id
       WHERE ui.usuario_id = ?
       ORDER BY i.nome`,
      [userId]
    );
    return igrejas;
  }
};

module.exports = {
  authenticate,
  isAdmin,
  checkIgrejaAccess,
  getUserIgrejas
};
