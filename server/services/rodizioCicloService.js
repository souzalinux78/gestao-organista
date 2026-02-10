/**
 * Geração de rodízio com Ciclos fixos por ordem de culto (SaaS).
 * - Cultos ordenados por dia_semana (Dom=0..Sáb=6) e hora → Slot 1, 2, 3...
 * - Slot 1 → Ciclo 1, Slot 2 → Ciclo 2, Slot 3 → Ciclo 3 (Culto N → Ciclo N).
 * - Um iterador (ponteiro) independente por ciclo.
 * - culto.permite_alunas = 0: apenas oficializadas (nem meia hora para aluna).
 * - Oficializada: dobradinha; Aluna (se permitido): só meia_hora, culto = próxima oficializada.
 * - Anti-repetição: não escalar se tocou ontem/amanhã.
 */

const db = require('../database/db');
const { getProximaData, adicionarMeses, formatarData, calcularHoraMeiaHora, DIAS_SEMANA } = require('../utils/dateHelpers');
const rodizioRepository = require('./rodizioRepository');
const cicloRepository = require('./cicloRepository');

const PONTEIRO_CHAVE = (igrejaId, numeroCiclo) => `rodizio_ponteiro_${igrejaId}_ciclo_${numeroCiclo}`;

function organistaEmDiaConsecutivo(organistaId, dataCultoStr, rodizios) {
  const [y, m, d] = dataCultoStr.split('-').map(Number);
  const data = new Date(y, m - 1, d);
  const umDia = 24 * 60 * 60 * 1000;
  const anterior = formatarData(new Date(data.getTime() - umDia));
  const posterior = formatarData(new Date(data.getTime() + umDia));
  return rodizios.some(
    r => r.organista_id === organistaId && (r.data_culto === anterior || r.data_culto === posterior)
  );
}

/** Retorna true se o culto não permite alunas (apenas oficializadas). Se a coluna não existir, trata como permitido. */
function cultoNaoPermiteAlunas(culto) {
  const v = culto.permite_alunas;
  return v === 0 || v === false;
}

/**
 * Iterador para uma única lista (um ciclo). Cursor circular; estado persistido por ciclo.
 */
class CicloIterator {
  constructor(itens, lastIndex = 0) {
    this.lista = Array.isArray(itens) ? itens : [];
    this.L = this.lista.length;
    this.cursor = typeof lastIndex === 'number' && lastIndex >= 0 ? lastIndex : 0;
  }

  proxima() {
    if (this.L === 0) return null;
    const idx = this.cursor % this.L;
    const organista = this.lista[idx];
    this.cursor += 1;
    return organista;
  }

  getCursor() {
    return this.cursor;
  }
}

async function carregarPonteirosPorCiclo(pool, igrejaId, N) {
  const ponteiros = {};
  for (let num = 1; num <= N; num++) {
    const [rows] = await pool.execute('SELECT valor FROM configuracoes WHERE chave = ?', [PONTEIRO_CHAVE(igrejaId, num)]);
    const v = rows[0]?.valor;
    const parsed = v !== undefined && v !== null && v !== '' ? parseInt(v, 10) : NaN;
    ponteiros[num] = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }
  return ponteiros;
}

async function salvarPonteirosPorCiclo(pool, igrejaId, ponteiros) {
  for (const [numStr, valor] of Object.entries(ponteiros)) {
    const chave = PONTEIRO_CHAVE(igrejaId, Number(numStr));
    const descricao = `Último índice usado no Ciclo ${numStr} (rodízio igreja ${igrejaId})`;
    const [existe] = await pool.execute('SELECT id FROM configuracoes WHERE chave = ?', [chave]);
    if (existe.length > 0) {
      await pool.execute('UPDATE configuracoes SET valor = ?, descricao = ? WHERE chave = ?', [String(valor), descricao, chave]);
    } else {
      await pool.execute('INSERT INTO configuracoes (chave, valor, descricao) VALUES (?, ?, ?)', [chave, String(valor), descricao]);
    }
  }
}

/**
 * Ordena cultos por ordem cronológica semanal: dia_semana (Dom=0 a Sáb=6) e hora.
 * O 1º da lista = Slot 1, 2º = Slot 2, etc. (Culto N → Ciclo N).
 */
function ordenarCultosPorSlot(cultos) {
  return [...cultos].sort((a, b) => {
    const diaA = DIAS_SEMANA[(a.dia_semana || '').toLowerCase()] ?? 99;
    const diaB = DIAS_SEMANA[(b.dia_semana || '').toLowerCase()] ?? 99;
    if (diaA !== diaB) return diaA - diaB;
    const horaA = a.hora ? (typeof a.hora === 'string' ? a.hora : a.hora.toTimeString?.().slice(0, 8) || '00:00:00') : '00:00:00';
    const horaB = b.hora ? (typeof b.hora === 'string' ? b.hora : b.hora.toTimeString?.().slice(0, 8) || '00:00:00') : '00:00:00';
    return horaA.localeCompare(horaB);
  });
}

/**
 * Gera rodízio com ciclos fixos por ordem de culto (Slot N → Ciclo N) e validação permite_alunas.
 * organistaInicial / organistaInicialId: ID da organista para começar no PRIMEIRO culto da geração (sobrescreve last_index do ciclo).
 */
const gerarRodizioComCiclos = async (igrejaId, periodoMeses, cicloInicial, dataInicial, organistaInicial) => {
  const pool = db.getDb();
  const [igrejas] = await pool.execute('SELECT * FROM igrejas WHERE id = ?', [igrejaId]);
  if (igrejas.length === 0) throw new Error('Igreja não encontrada');

  const [cultosRaw] = await pool.execute(
    'SELECT * FROM cultos WHERE igreja_id = ? AND ativo = 1',
    [igrejaId]
  );
  const cultos = ordenarCultosPorSlot(cultosRaw);
  if (cultos.length === 0) throw new Error('Nenhum culto ativo encontrado para esta igreja');

  const N = Math.max(cultos.length, 1);
  const listasPorCiclo = {};
  let temCicloConfigurado = false;
  for (let num = 1; num <= N; num++) {
    const itens = await cicloRepository.getCicloComoListaOrganistas(igrejaId, num);
    if (itens.length > 0) temCicloConfigurado = true;
    listasPorCiclo[num] = itens.map(o => ({
      id: o.id,
      nome: o.nome,
      oficializada: o.oficializada === 1 || o.oficializada === true
    }));
  }

  if (!temCicloConfigurado) {
    const organistasBase = await cicloRepository.getOrganistasDaIgreja(igrejaId);
    const lista = organistasBase.map(o => ({
      id: o.id,
      nome: o.nome,
      oficializada: o.oficializada === 1 || o.oficializada === true
    }));
    for (let num = 1; num <= N; num++) listasPorCiclo[num] = [...lista];
  }

  const dataInicio = dataInicial ? new Date(dataInicial) : new Date();
  const dataFim = adicionarMeses(dataInicio, periodoMeses);
  const dataInicioStr = formatarData(dataInicio);

  // Montar todas as datas a preencher ANTES dos iteradores (para saber o ciclo do 1º culto).
  const todasDatas = [];
  for (let slotIndex = 0; slotIndex < cultos.length; slotIndex++) {
    const culto = cultos[slotIndex];
    const slot = slotIndex + 1;
    let dataAtual = getProximaData(culto.dia_semana, dataInicio);
    while (dataAtual <= dataFim) {
      const dataFormatada = formatarData(dataAtual);
      const existe = await rodizioRepository.existeRodizio(culto.id, dataFormatada);
      if (!existe) {
        todasDatas.push({
          culto,
          data: new Date(dataAtual),
          dataFormatada,
          slotIndex: slot
        });
      }
      dataAtual = new Date(dataAtual);
      dataAtual.setDate(dataAtual.getDate() + 7);
    }
  }
  todasDatas.sort((a, b) => a.data - b.data);

  const ponteiros = await carregarPonteirosPorCiclo(pool, igrejaId, N);

  // Prioridade do ponteiro inicial: (1) Override do usuário, (2) last_index do banco, (3) 0.
  const organistaInicialId = organistaInicial != null && organistaInicial !== '' ? Number(organistaInicial) : null;
  const cicloInicialNum = cicloInicial != null && cicloInicial !== '' ? Number(cicloInicial) : null;

  const iteradores = {};
  for (let num = 1; num <= N; num++) {
    let startIndex = ponteiros[num];

    // Override (Prioridade 1): usuário mandou organistaInicialId e este é o ciclo escolhido (cicloInicial).
    if (organistaInicialId != null && !isNaN(organistaInicialId)) {
      const cicloAlvo = cicloInicialNum >= 1 && cicloInicialNum <= N ? cicloInicialNum : (todasDatas.length > 0 ? todasDatas[0].slotIndex : null);
      if (cicloAlvo === num) {
        const fila = listasPorCiclo[num] || [];
        const overrideIndex = fila.findIndex(o => o.id === organistaInicialId);
        if (overrideIndex !== -1) {
          startIndex = overrideIndex;
        }
      }
    }

    iteradores[num] = new CicloIterator(listasPorCiclo[num] || [], startIndex);
  }

  const rodiziosExistentes = await rodizioRepository.buscarRodiziosCompletos(
    igrejaId,
    dataInicioStr,
    formatarData(dataFim)
  );
  const novosRodizios = [];
  const rodiziosParaRegra = () => [
    ...rodiziosExistentes.map(r => ({ organista_id: r.organista_id, data_culto: r.data_culto })),
    ...novosRodizios.map(r => ({ organista_id: r.organista_id, data_culto: r.data_culto }))
  ];

  const periodoInicio = formatarData(dataInicio);
  const periodoFim = formatarData(dataFim);

  for (const item of todasDatas) {
    const { culto, dataFormatada, slotIndex } = item;
    const numeroCiclo = slotIndex;
    const iterator = iteradores[numeroCiclo];
    const lista = listasPorCiclo[numeroCiclo] || [];
    if (!lista.length) continue;

    const paraRegra = rodiziosParaRegra();
    const jaNestaData = new Set(
      novosRodizios
        .filter(r => r.data_culto === dataFormatada && r.culto_id === culto.id)
        .map(r => r.organista_id)
    );
    const bloqueadoAlunas = cultoNaoPermiteAlunas(culto);

    // ——— Meia Hora ———
    // Próxima da fila do ciclo. Se culto não permite alunas, pular até oficializada.
    // Se vier Aluna (e culto permite): escala para meia hora; culto será outra (oficializada).
    let organistaMeiaHora = null;
    for (let t = 0; t < lista.length; t++) {
      const cand = iterator.proxima();
      if (!cand) break;
      if (jaNestaData.has(cand.id)) continue;
      if (organistaEmDiaConsecutivo(cand.id, dataFormatada, paraRegra)) continue;
      if (bloqueadoAlunas && !cand.oficializada) continue;
      organistaMeiaHora = cand;
      break;
    }
    if (!organistaMeiaHora) continue;

    jaNestaData.add(organistaMeiaHora.id);

    // ——— Culto ———
    // Aluna NUNCA toca culto sozinha: só meia hora. Oficializada pode dobradinha.
    let organistaTocarCulto;
    if (organistaMeiaHora.oficializada) {
      organistaTocarCulto = organistaMeiaHora;
    } else {
      // Meia hora foi Aluna → avançar iterador até achar Oficializada para o culto (pular alunas).
      organistaTocarCulto = null;
      for (let t = 0; t < lista.length; t++) {
        const cand = iterator.proxima();
        if (!cand) break;
        if (!cand.oficializada) continue; // Aluna: proibido no culto; pular.
        if (jaNestaData.has(cand.id)) continue;
        if (organistaEmDiaConsecutivo(cand.id, dataFormatada, paraRegra)) continue;
        organistaTocarCulto = cand;
        break;
      }
      if (!organistaTocarCulto) continue;
    }

    const horaMeiaHora = calcularHoraMeiaHora(culto.hora);

    novosRodizios.push({
      igreja_id: igrejaId,
      culto_id: culto.id,
      organista_id: organistaMeiaHora.id,
      data_culto: dataFormatada,
      hora_culto: horaMeiaHora,
      dia_semana: culto.dia_semana,
      funcao: 'meia_hora',
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim
    });
    novosRodizios.push({
      igreja_id: igrejaId,
      culto_id: culto.id,
      organista_id: organistaTocarCulto.id,
      data_culto: dataFormatada,
      hora_culto: culto.hora,
      dia_semana: culto.dia_semana,
      funcao: 'tocar_culto',
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim
    });
  }

  if (novosRodizios.length > 0) {
    await rodizioRepository.inserirRodizios(novosRodizios);
    for (let num = 1; num <= N; num++) {
      ponteiros[num] = iteradores[num].getCursor();
    }
    await salvarPonteirosPorCiclo(pool, igrejaId, ponteiros);
  }

  return rodizioRepository.buscarRodiziosCompletos(
    igrejaId,
    dataInicioStr,
    formatarData(dataFim)
  );
};

module.exports = {
  gerarRodizioComCiclos,
  CicloIterator,
  ordenarCultosPorSlot,
  cultoNaoPermiteAlunas,
  organistaEmDiaConsecutivo,
  carregarPonteirosPorCiclo,
  salvarPonteirosPorCiclo
};
