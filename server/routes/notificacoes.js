const express = require('express');
const router = express.Router();
const db = require('../database/db');
const notificacaoService = require('../services/notificacaoService');
const notificacaoConfigService = require('../services/notificacaoConfigService');
const { authenticate, getUserIgrejas } = require('../middleware/auth');
const { tenantResolver, getTenantId } = require('../middleware/tenantResolver');
const { checkIgrejaAccess } = require('../middleware/igrejaAccess');

const canManageConfiguracao = (user) => user?.role === 'admin' || user?.tipo_usuario === 'encarregado';

const carregarIgrejaBase = async (pool, igrejaId) => {
  const [rows] = await pool.execute(
    `SELECT id, nome,
            encarregado_local_nome, encarregado_local_telefone,
            encarregado_regional_nome, encarregado_regional_telefone
     FROM igrejas
     WHERE id = ?
     LIMIT 1`,
    [igrejaId]
  );

  return rows[0] || null;
};

const montarMensagemTeste = ({ igrejaNome, horarioDia, horarioRjm }) => {
  return [
    'Teste de notificacao de rodizio (configuracoes)',
    '',
    `Igreja: ${igrejaNome || 'Nao informada'}`,
    `Horario consolidado (dia): ${horarioDia}`,
    `Horario consolidado (RJM domingo 10:00): ${horarioRjm}`,
    '',
    'Se recebeu esta mensagem, o webhook esta funcionando.'
  ].join('\n');
};

// Listar notificacoes (filtrado por igrejas do usuario e tenant)
router.get('/', authenticate, tenantResolver, async (req, res) => {
  try {
    const pool = db.getDb();
    const tenantId = getTenantId(req);
    const igrejas = await getUserIgrejas(req.user.id, req.user.role === 'admin', tenantId);
    const igrejaIds = igrejas.map((i) => i.id);

    if (igrejaIds.length === 0) {
      return res.json([]);
    }

    const placeholders = igrejaIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT n.*, r.data_culto, o.nome as organista_nome, i.nome as igreja_nome
       FROM notificacoes n
       INNER JOIN rodizios r ON n.rodizio_id = r.id
       INNER JOIN organistas o ON r.organista_id = o.id
       INNER JOIN igrejas i ON r.igreja_id = i.id
       WHERE r.igreja_id IN (${placeholders})
       ORDER BY n.created_at DESC
       LIMIT 100`,
      igrejaIds
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Enviar notificacao manual para um rodizio
router.post('/enviar/:rodizio_id', authenticate, tenantResolver, async (req, res) => {
  try {
    const pool = db.getDb();

    const [rows] = await pool.execute(
      `SELECT r.*,
              o.nome as organista_nome, o.telefone as organista_telefone, o.email as organista_email,
              i.nome as igreja_nome,
              i.encarregado_local_nome, i.encarregado_local_telefone,
              i.encarregado_regional_nome, i.encarregado_regional_telefone,
              c.dia_semana, c.hora as hora_culto
       FROM rodizios r
       INNER JOIN organistas o ON r.organista_id = o.id
       INNER JOIN igrejas i ON r.igreja_id = i.id
       INNER JOIN cultos c ON r.culto_id = c.id
       WHERE r.id = ?`,
      [req.params.rodizio_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Rodizio nao encontrado' });
    }

    if (req.user.role !== 'admin') {
      const [associations] = await pool.execute(
        'SELECT 1 FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ? LIMIT 1',
        [req.user.id, rows[0].igreja_id]
      );

      if (associations.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a este rodizio' });
      }
    }

    await notificacaoService.enviarNotificacaoDiaCulto(rows[0]);
    return res.json({ message: 'Notificacao enviada com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Buscar configuracao de envio consolidado por igreja
router.get('/configuracoes', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    if (!canManageConfiguracao(req.user)) {
      return res.status(403).json({ error: 'Somente admin ou encarregado podem configurar envios.' });
    }

    const pool = db.getDb();
    const igreja = await carregarIgrejaBase(pool, req.igrejaId);

    if (!igreja) {
      return res.status(404).json({ error: 'Igreja nao encontrada' });
    }

    const config = await notificacaoConfigService.getConfiguracaoEnvio(pool, req.igrejaId, igreja);

    return res.json({
      sucesso: true,
      igreja_id: req.igrejaId,
      igreja_nome: igreja.nome,
      configuracao: config,
      cargos_disponiveis: notificacaoConfigService.CARGOS_DISPONIVEIS
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Salvar configuracao de envio consolidado por igreja
router.put('/configuracoes', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    if (!canManageConfiguracao(req.user)) {
      return res.status(403).json({ error: 'Somente admin ou encarregado podem configurar envios.' });
    }

    const pool = db.getDb();
    const igreja = await carregarIgrejaBase(pool, req.igrejaId);

    if (!igreja) {
      return res.status(404).json({ error: 'Igreja nao encontrada' });
    }

    const configuracao = await notificacaoConfigService.salvarConfiguracaoEnvio(pool, req.igrejaId, {
      horario_dia: req.body.horario_dia,
      horario_rjm: req.body.horario_rjm,
      destinatarios: req.body.destinatarios
    }, igreja);

    return res.json({
      sucesso: true,
      message: 'Configuracao de envio salva com sucesso.',
      igreja_id: req.igrejaId,
      configuracao
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Testar envio para telefone especifico
router.post('/configuracoes/teste', authenticate, tenantResolver, checkIgrejaAccess, async (req, res) => {
  try {
    if (!canManageConfiguracao(req.user)) {
      return res.status(403).json({ error: 'Somente admin ou encarregado podem testar envios.' });
    }

    const telefone = String(req.body.telefone || '').trim();
    if (!telefone) {
      return res.status(400).json({ error: 'Telefone de teste e obrigatorio.' });
    }

    const pool = db.getDb();
    const igreja = await carregarIgrejaBase(pool, req.igrejaId);

    if (!igreja) {
      return res.status(404).json({ error: 'Igreja nao encontrada' });
    }

    const config = await notificacaoConfigService.getConfiguracaoEnvio(pool, req.igrejaId, igreja);
    const mensagem = String(req.body.mensagem || '').trim() || montarMensagemTeste({
      igrejaNome: igreja.nome,
      horarioDia: config.horario_dia,
      horarioRjm: config.horario_rjm
    });

    const cargo = String(req.body.cargo || '').trim() || 'teste';
    const nomeDestinatario = String(req.body.nome || '').trim() || null;

    await notificacaoService.enviarMensagemTesteConfiguracao({
      telefone,
      mensagem,
      igrejaNome: igreja.nome,
      usuarioNome: req.user?.nome || req.user?.email || 'usuario',
      cargo,
      nomeDestinatario
    });

    return res.json({
      sucesso: true,
      message: 'Mensagem de teste enviada com sucesso.'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
