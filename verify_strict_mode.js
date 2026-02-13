
const db = require('./server/database/db');
const rodizioService = require('./server/services/rodizioCicloService');
require('dotenv').config({ path: './.env' });

async function verify() {
    try {
        await db.init();
        console.log('--- STARTING VERIFICATION ---');

        // Config: Church 5, 1 Month, Start Today
        const igrejaId = 5;
        const periodoMeses = 1;
        const dataInicial = new Date().toISOString().split('T')[0];

        // Run Generation
        const rodizios = await rodizioService.gerarRodizioComCiclos(igrejaId, periodoMeses, null, dataInicial, null);

        console.log(`\nGenerated ${rodizios.length} entries.`);

        // Filter RJM Services
        const rjmRodizios = rodizios.filter(r => r.culto_tipo === 'rjm' || r.funcao === 'tocar_culto_rjm'); // Check logic in repository

        // Since rodizioService returns "buscados" (fetched) rodizios, the structure depends on "buscarRodiziosCompletos"
        // Let's filter by service type/day
        const quintasRJM = rodizios.filter(r => r.dia_semana === 'quinta' && r.hora_culto >= '19:00:00');
        const domingosRJM = rodizios.filter(r => r.dia_semana === 'domingo' && r.hora_culto === '10:00:00' && (r.culto_tipo === 'rjm'));

        console.log('\n--- QUINTA RJM SAMPLES ---');
        quintasRJM.slice(0, 3).forEach(r => console.log(`${r.data_culto} ${r.hora_culto}: ${r.organista_nome} (Ciclo: ${r.ciclo_origem})`));

        console.log('\n--- DOMINGO RJM SAMPLES ---');
        domingosRJM.slice(0, 3).forEach(r => console.log(`${r.data_culto} ${r.hora_culto}: ${r.organista_nome} (Ciclo: ${r.ciclo_origem})`));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

verify();
