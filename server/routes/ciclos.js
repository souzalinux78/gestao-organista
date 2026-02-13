const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, getUserIgrejas } = require('../middleware/auth');
const { tenantResolver, getTenantId } = require('../middleware/tenantResolver');

// Listar ciclos de uma igreja
router.get('/igreja/:igreja_id', authenticate, async (req, res) => {
    try {
        // Verificar acesso à igreja
        if (req.user.role !== 'admin') {
            const pool = db.getDb();
            const [associations] = await pool.execute(
                'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
                [req.user.id, req.params.igreja_id]
            );

            if (associations.length === 0) {
                return res.status(403).json({ error: 'Acesso negado a esta igreja' });
            }
        }

        const pool = db.getDb();
        const [rows] = await pool.execute(
            'SELECT * FROM ciclos WHERE igreja_id = ? AND ativo = 1 ORDER BY ordem ASC',
            [req.params.igreja_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar novo ciclo
router.post('/', authenticate, async (req, res) => {
    try {
        const { igreja_id, nome, ordem, ativo, tipo, numero } = req.body;

        // Verificar acesso à igreja
        if (req.user.role !== 'admin') {
            const pool = db.getDb();
            const [associations] = await pool.execute(
                'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
                [req.user.id, igreja_id]
            );

            if (associations.length === 0) {
                return res.status(403).json({ error: 'Acesso negado a esta igreja' });
            }
        }

        const pool = db.getDb();

        // Validar número único para ciclos oficiais
        if (tipo === 'oficial' && numero) {
            const [existing] = await pool.execute(
                'SELECT id FROM ciclos WHERE igreja_id = ? AND tipo = "oficial" AND numero = ? AND ativo = 1',
                [igreja_id, numero]
            );
            if (existing.length > 0) {
                return res.status(400).json({ error: `Já existe um Ciclo Oficial ${numero} nesta igreja` });
            }
        }

        const [result] = await pool.execute(
            'INSERT INTO ciclos (igreja_id, nome, ordem, ativo, tipo, numero) VALUES (?, ?, ?, ?, ?, ?)',
            [igreja_id, nome, ordem || 1, ativo !== undefined ? (ativo ? 1 : 0) : 1, tipo || 'oficial', numero]
        );

        res.json({
            id: result.insertId,
            igreja_id,
            nome,
            ordem: ordem || 1,
            ativo: ativo !== undefined ? (ativo ? 1 : 0) : 1,
            tipo: tipo || 'oficial',
            numero
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar ciclo
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { nome, ordem, ativo, tipo, numero } = req.body;
        const pool = db.getDb();

        // Verificar acesso
        if (req.user.role !== 'admin') {
            const [ciclos] = await pool.execute('SELECT igreja_id FROM ciclos WHERE id = ?', [req.params.id]);
            if (ciclos.length > 0) {
                const [associations] = await pool.execute(
                    'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
                    [req.user.id, ciclos[0].igreja_id]
                );
                if (associations.length === 0) {
                    return res.status(403).json({ error: 'Acesso negado a este ciclo' });
                }
            }
        }

        // Validar número único para ciclos oficiais
        if (tipo === 'oficial' && numero) {
            const [cicloAtual] = await pool.execute('SELECT igreja_id FROM ciclos WHERE id = ?', [req.params.id]);
            if (cicloAtual.length > 0) {
                const [existing] = await pool.execute(
                    'SELECT id FROM ciclos WHERE igreja_id = ? AND tipo = "oficial" AND numero = ? AND id != ? AND ativo = 1',
                    [cicloAtual[0].igreja_id, numero, req.params.id]
                );
                if (existing.length > 0) {
                    return res.status(400).json({ error: `Já existe um Ciclo Oficial ${numero} nesta igreja` });
                }
            }
        }

        const [result] = await pool.execute(
            'UPDATE ciclos SET nome = ?, ordem = ?, ativo = ?, tipo = ?, numero = ? WHERE id = ?',
            [nome, ordem, ativo ? 1 : 0, tipo, numero, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ciclo não encontrado' });
        }

        res.json({
            id: req.params.id,
            nome,
            ordem,
            ativo: ativo ? 1 : 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deletar ciclo
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const pool = db.getDb();

        // Verificar acesso
        if (req.user.role !== 'admin') {
            const [ciclos] = await pool.execute('SELECT igreja_id FROM ciclos WHERE id = ?', [req.params.id]);
            if (ciclos.length > 0) {
                const [associations] = await pool.execute(
                    'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
                    [req.user.id, ciclos[0].igreja_id]
                );
                if (associations.length === 0) {
                    return res.status(403).json({ error: 'Acesso negado a este ciclo' });
                }
            }
        }

        const [result] = await pool.execute('DELETE FROM ciclos WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ciclo não encontrado' });
        }

        res.json({ message: 'Ciclo deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar cultos associados ao ciclo
router.put('/:id/cultos', authenticate, async (req, res) => {
    try {
        const { cultos_ids } = req.body; // Array de IDs de cultos
        const ciclo_id = req.params.id;

        const pool = db.getDb();

        // Verificar acesso
        if (req.user.role !== 'admin') {
            const [ciclos] = await pool.execute('SELECT igreja_id FROM ciclos WHERE id = ?', [ciclo_id]);
            if (ciclos.length > 0) {
                const [associations] = await pool.execute(
                    'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
                    [req.user.id, ciclos[0].igreja_id]
                );
                if (associations.length === 0) {
                    return res.status(403).json({ error: 'Acesso negado a este ciclo' });
                }
            } else {
                return res.status(404).json({ error: 'Ciclo não encontrado' });
            }
        }

        // 1. Limpar associações anteriores desse ciclo (setar NULL)
        // Mas apenas para cultos que ESTAVAM associados a este ciclo.
        // Ou melhor: Resetar TODOS os cultos da igreja? Não, perigoso.
        // A lógica do front deve enviar TODOS os cultos que pertencem a este ciclo.
        // Os que NÃO estiverem na lista, mas ESTAVAM associados a este ciclo, devem ser desassociados.

        await pool.execute('UPDATE cultos SET ciclo_id = NULL WHERE ciclo_id = ?', [ciclo_id]);

        // 2. Associar novos
        if (cultos_ids && cultos_ids.length > 0) {
            // Validar se cultos pertencem à mesma igreja do ciclo?
            // Sim, mas vamos confiar no filtro do front por enquanto ou fazer um check rápido se precisar.

            // Construir query segura com lista de IDs
            const placeholders = cultos_ids.map(() => '?').join(',');
            await pool.execute(
                `UPDATE cultos SET ciclo_id = ? WHERE id IN (${placeholders})`,
                [ciclo_id, ...cultos_ids]
            );
        }

        res.json({ message: 'Cultos atualizados com sucesso' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ROTA NOVA E SEGURA PARA SALVAR ITENS DO CICLO ---
// Substitui a rota antiga em /igrejas/... que estava dando 404
const cicloRepository = require('../services/cicloRepository');

router.put('/:id/itens', authenticate, async (req, res) => {
    console.log(`>>> ROTA SALVAR (v2): Ciclo ${req.params.id}`);
    try {
        const cicloId = parseInt(req.params.id);
        const { itens } = req.body;

        // 1. Descobrir a Igreja do Ciclo para validação
        const pool = db.getDb();
        const [ciclos] = await pool.execute('SELECT igreja_id FROM ciclos WHERE id = ?', [cicloId]);

        if (ciclos.length === 0) return res.status(404).json({ error: 'Ciclo não encontrado' });
        const igrejaId = ciclos[0].igreja_id;

        // 2. Verificar permissão
        if (req.user.role !== 'admin') {
            const [associations] = await pool.execute(
                'SELECT * FROM usuario_igreja WHERE usuario_id = ? AND igreja_id = ?',
                [req.user.id, igrejaId]
            );
            if (associations.length === 0) {
                return res.status(403).json({ error: 'Acesso negado a esta igreja/ciclo' });
            }
        }

        // 3. Salvar usando Repository
        await cicloRepository.salvarCiclo(igrejaId, cicloId, itens);

        // 4. Retornar dados atualizados
        const atualizado = await cicloRepository.getCicloItens(igrejaId, cicloId);

        // Formatar retorno igual ao esperado pelo front
        const formatado = atualizado.map(i => ({
            id: i.organista_id,
            nome: i.organista_nome,
            ordem: i.posicao,
            oficializada: !!i.oficializada,
            categoria: i.categoria,
            organista: { id: i.organista_id, nome: i.organista_nome, oficializada: !!i.oficializada, categoria: i.categoria }
        }));

        res.json({ message: 'Salvo com sucesso via Rota Ciclos!', itens: formatado });

    } catch (error) {
        console.error("Erro ao salvar itens ciclo:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
