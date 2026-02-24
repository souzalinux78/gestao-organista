const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, getUserIgrejas } = require('../middleware/auth');
const { tenantResolver, getTenantId } = require('../middleware/tenantResolver');

const normalizeCycleText = (value) => {
    if (!value) return '';
    return String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
};

const inferCycleType = (tipo, nome) => {
    const tipoNorm = normalizeCycleText(tipo);
    if (tipoNorm === 'rjm' || tipoNorm === 'oficial') {
        return tipoNorm;
    }

    const nomeNorm = normalizeCycleText(nome);
    if (nomeNorm === 'rjm' || nomeNorm.includes('rjm')) {
        return 'rjm';
    }

    return 'oficial';
};

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
        const tipoFinal = inferCycleType(tipo, nome);
        const numeroFinal = tipoFinal === 'oficial' && numero ? parseInt(numero) : null;

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
        if (tipoFinal === 'oficial' && numeroFinal) {
            const [existing] = await pool.execute(
                'SELECT id FROM ciclos WHERE igreja_id = ? AND tipo = "oficial" AND numero = ? AND ativo = 1',
                [igreja_id, numeroFinal]
            );
            if (existing.length > 0) {
                return res.status(400).json({ error: `Já existe um Ciclo Oficial ${numeroFinal} nesta igreja` });
            }
        }

        const [result] = await pool.execute(
            'INSERT INTO ciclos (igreja_id, nome, ordem, ativo, tipo, numero) VALUES (?, ?, ?, ?, ?, ?)',
            [igreja_id, nome, ordem || 1, ativo !== undefined ? (ativo ? 1 : 0) : 1, tipoFinal, numeroFinal]
        );

        res.json({
            id: result.insertId,
            igreja_id,
            nome,
            ordem: ordem || 1,
            ativo: ativo !== undefined ? (ativo ? 1 : 0) : 1,
            tipo: tipoFinal,
            numero: numeroFinal
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
        const tipoFinal = inferCycleType(tipo, nome);
        const numeroFinal = tipoFinal === 'oficial' && numero ? parseInt(numero) : null;

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
        if (tipoFinal === 'oficial' && numeroFinal) {
            const [cicloAtual] = await pool.execute('SELECT igreja_id FROM ciclos WHERE id = ?', [req.params.id]);
            if (cicloAtual.length > 0) {
                const [existing] = await pool.execute(
                    'SELECT id FROM ciclos WHERE igreja_id = ? AND tipo = "oficial" AND numero = ? AND id != ? AND ativo = 1',
                    [cicloAtual[0].igreja_id, numeroFinal, req.params.id]
                );
                if (existing.length > 0) {
                    return res.status(400).json({ error: `Já existe um Ciclo Oficial ${numeroFinal} nesta igreja` });
                }
            }
        }

        const [result] = await pool.execute(
            'UPDATE ciclos SET nome = ?, ordem = ?, ativo = ?, tipo = ?, numero = ? WHERE id = ?',
            [nome, ordem, ativo ? 1 : 0, tipoFinal, numeroFinal, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ciclo não encontrado' });
        }

        res.json({
            id: req.params.id,
            nome,
            ordem,
            ativo: ativo ? 1 : 0,
            tipo: tipoFinal,
            numero: numeroFinal
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

// Atualizar cultos associados ao ciclo (usando tabela ciclos_cultos)
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

        // 1. Remover associações antigas deste ciclo na tabela ciclos_cultos
        await pool.execute('DELETE FROM ciclos_cultos WHERE ciclo_id = ?', [ciclo_id]);

        // 2. Inserir novas associações
        if (cultos_ids && cultos_ids.length > 0) {
            // Validar que os cultos existem e pertencem à mesma igreja do ciclo (segurança multi-tenant)
            const [cicloInfo] = await pool.execute('SELECT igreja_id FROM ciclos WHERE id = ?', [ciclo_id]);

            if (cicloInfo.length > 0) {
                const igrejaId = cicloInfo[0].igreja_id;

                // Verificar que todos os cultos pertencem à igreja
                const placeholders = cultos_ids.map(() => '?').join(',');
                const [cultosValidos] = await pool.execute(
                    `SELECT id FROM cultos WHERE id IN (${placeholders}) AND igreja_id = ?`,
                    [...cultos_ids, igrejaId]
                );

                // Inserir apenas os cultos válidos
                if (cultosValidos.length > 0) {
                    const values = cultosValidos.map(c => [ciclo_id, c.id]);
                    await pool.query(
                        'INSERT INTO ciclos_cultos (ciclo_id, culto_id) VALUES ?',
                        [values]
                    );
                }
            }
        }

        // 3. Ajuste defensivo do tipo do ciclo conforme cultos associados.
        // Se todos os cultos do ciclo forem RJM, o ciclo vira RJM; caso contrário, oficial.
        const [tiposCultos] = await pool.execute(
            `SELECT c.tipo
             FROM ciclos_cultos cc
             INNER JOIN cultos c ON c.id = cc.culto_id
             WHERE cc.ciclo_id = ?`,
            [ciclo_id]
        );

        if (tiposCultos.length > 0) {
            const todosRjm = tiposCultos.every(c => String(c.tipo || '').toLowerCase() === 'rjm');
            const tipoFinal = todosRjm ? 'rjm' : 'oficial';
            await pool.execute(
                'UPDATE ciclos SET tipo = ?, numero = CASE WHEN ? = "rjm" THEN NULL ELSE numero END WHERE id = ?',
                [tipoFinal, tipoFinal, ciclo_id]
            );
        } else {
            // Sem culto associado: usa inferência por nome para evitar ciclo "RJM" salvo como oficial.
            const [cycleRows] = await pool.execute('SELECT nome FROM ciclos WHERE id = ?', [ciclo_id]);
            if (cycleRows.length > 0) {
                const tipoFinal = inferCycleType(null, cycleRows[0].nome);
                await pool.execute(
                    'UPDATE ciclos SET tipo = ?, numero = CASE WHEN ? = "rjm" THEN NULL ELSE numero END WHERE id = ?',
                    [tipoFinal, tipoFinal, ciclo_id]
                );
            }
        }

        res.json({ message: 'Cultos atualizados com sucesso' });

    } catch (error) {
        console.error('Erro ao associar cultos:', error);
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
