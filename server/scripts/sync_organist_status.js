const db = require('../database/db');

const syncOrganistStatus = async () => {
    try {
        await db.init();
        const pool = db.getDb();
        console.log('🚀 Sincronizando Status de Organistas (Categoria vs Oficializada)...');

        // 1. Corrigir Oficial/RJM que estão como não oficializadas
        const [res1] = await pool.execute(`
            UPDATE organistas 
            SET oficializada = 1 
            WHERE (categoria = 'oficial' OR categoria = 'rjm') AND oficializada = 0
        `);
        console.log(`✅ ${res1.affectedRows} organistas corrigidas para OFICIALIZADA=1`);

        // 2. Corrigir Alunas que estão como oficializadas
        const [res2] = await pool.execute(`
            UPDATE organistas 
            SET oficializada = 0 
            WHERE categoria = 'aluna' AND oficializada = 1
        `);
        console.log(`✅ ${res2.affectedRows} organistas corrigidas para OFICIALIZADA=0`);

        // 3. Atualizar tabela de associação (organistas_igreja) também
        // Isso é mais complexo pois depende de qual igreja... mas vamos assumir que a flag na tabela associativa deve refletir a organista
        // Vamos atualizar baseado no ID da organista

        // Update organistas_igreja based on organistas table
        await pool.execute(`
            UPDATE organistas_igreja oi
            JOIN organistas o ON oi.organista_id = o.id
            SET oi.oficializada = o.oficializada
            WHERE oi.oficializada != o.oficializada
        `);
        console.log(`✅ Associações organistas_igreja sincronizadas.`);

        console.log('🏁 Sincronização concluída!');

    } catch (error) {
        console.error('Erro fatal:', error);
    } finally {
        await db.close();
    }
};

if (require.main === module) {
    syncOrganistStatus();
}

module.exports = syncOrganistStatus;
