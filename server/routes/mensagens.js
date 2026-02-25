const express = require('express');
const router = express.Router();
const db = require('../database/db');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { tenantResolver } = require('../middleware/tenantResolver');
const { checkIgrejaAccess } = require('../middleware/igrejaAccess');
const { TEMPLATE_KEYS, TEMPLATE_PLACEHOLDERS } = require('../utils/messageTemplates');
const notificacaoService = require('../services/notificacaoService');

const MAX_TEMPLATE_LENGTH = 4000;

const canManageTemplates = (user) => {
  if (!user) return false;
  return user.role === 'admin' || user.tipo_usuario === 'encarregado';
};

function normalizeTemplateValue(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

async function getTemplates(pool, igrejaId) {
  const keyOrganista = TEMPLATE_KEYS.organista(igrejaId);
  const keyEncarregado = TEMPLATE_KEYS.encarregado(igrejaId);

  const [rows] = await pool.execute(
    'SELECT chave, valor FROM configuracoes WHERE chave IN (?, ?)',
    [keyOrganista, keyEncarregado]
  );

  const map = new Map(rows.map(r => [r.chave, r.valor]));
  return {
    organista: map.get(keyOrganista) || null,
    encarregado: map.get(keyEncarregado) || null
  };
}

router.get('/templates', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    if (!canManageTemplates(req.user)) {
      return res.status(403).json({ error: 'Apenas admin ou encarregado podem configurar mensagens.' });
    }

    const igrejaId = req.igrejaId;
    const pool = db.getDb();
    const templates = await getTemplates(pool, igrejaId);

    return res.json({
      sucesso: true,
      igreja_id: igrejaId,
      templates,
      placeholders: TEMPLATE_PLACEHOLDERS
    });
  } catch (error) {
    logger.error('Erro ao buscar templates de mensagem', {
      userId: req.user?.id,
      igrejaId: req.igrejaId,
      error: error.message
    });
    return res.status(500).json({ error: 'Erro ao buscar templates de mensagem.' });
  }
});

router.put('/templates', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    if (!canManageTemplates(req.user)) {
      return res.status(403).json({ error: 'Apenas admin ou encarregado podem configurar mensagens.' });
    }

    const igrejaId = req.igrejaId;
    const pool = db.getDb();

    const organistaTemplate = normalizeTemplateValue(req.body.organista_template);
    const encarregadoTemplate = normalizeTemplateValue(req.body.encarregado_template);

    if (organistaTemplate && organistaTemplate.length > MAX_TEMPLATE_LENGTH) {
      return res.status(400).json({ error: `Template da organista excede ${MAX_TEMPLATE_LENGTH} caracteres.` });
    }
    if (encarregadoTemplate && encarregadoTemplate.length > MAX_TEMPLATE_LENGTH) {
      return res.status(400).json({ error: `Template do encarregado excede ${MAX_TEMPLATE_LENGTH} caracteres.` });
    }

    const updates = [
      {
        key: TEMPLATE_KEYS.organista(igrejaId),
        value: organistaTemplate,
        descricao: `Template da mensagem para organista (igreja ${igrejaId})`
      },
      {
        key: TEMPLATE_KEYS.encarregado(igrejaId),
        value: encarregadoTemplate,
        descricao: `Template da mensagem para encarregado (igreja ${igrejaId})`
      }
    ];

    for (const item of updates) {
      if (item.value === null) {
        await pool.execute('DELETE FROM configuracoes WHERE chave = ?', [item.key]);
      } else {
        await pool.execute(
          `INSERT INTO configuracoes (chave, valor, descricao)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             valor = VALUES(valor),
             descricao = VALUES(descricao),
             updated_at = CURRENT_TIMESTAMP`,
          [item.key, item.value, item.descricao]
        );
      }
    }

    const templates = await getTemplates(pool, igrejaId);
    notificacaoService.clearTemplateCache(igrejaId);

    logger.info('Templates de mensagem atualizados', {
      userId: req.user?.id,
      igrejaId,
      tipoUsuario: req.user?.tipo_usuario || req.user?.role
    });

    return res.json({
      sucesso: true,
      message: 'Templates de mensagem salvos com sucesso.',
      igreja_id: igrejaId,
      templates
    });
  } catch (error) {
    logger.error('Erro ao salvar templates de mensagem', {
      userId: req.user?.id,
      igrejaId: req.igrejaId,
      error: error.message
    });
    return res.status(500).json({ error: 'Erro ao salvar templates de mensagem.' });
  }
});

module.exports = router;
