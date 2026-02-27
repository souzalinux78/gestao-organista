import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getOrganistas,
  getIgrejas,
  getRodizios,
  getCultos,
  getMetrics,
  getLogs,
  testarWebhook
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { getErrorMessage } from '../utils/errorMessages';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './Home.css';

const DIA_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

const normalizeText = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const toIsoDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, showError, showSuccess, hideToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [igrejas, setIgrejas] = useState([]);
  const [filtrosDashboard, setFiltrosDashboard] = useState({
    igreja_id: '',
    periodo_meses: 6
  });
  const [stats, setStats] = useState({
    organistas: 0,
    igrejas: 0,
    rodizios: 0,
    cultos: 0,
    rodiziosProximos: []
  });
  const [rodiziosPorMes, setRodiziosPorMes] = useState([]);
  const [ultimasAtividades, setUltimasAtividades] = useState([]);
  const [insights, setInsights] = useState({
    coberturaPct: 0,
    escalasEsperadas: 0,
    escalasCobertas: 0,
    tipoCulto: { culto: 0, meia_hora: 0, rjm: 0 },
    semTelefoneCount: 0,
    conflitosMesmoHorario: 0,
    webhookFalhas24h: null,
    proximoRodizio: null
  });
  const [webhookHealth, setWebhookHealth] = useState({
    status: 'idle',
    message: 'Webhook ainda nao testado no dashboard.',
    checkedAt: null
  });
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  const getRodizioDateTime = (rodizio) => {
    const dataRaw = String(rodizio?.data_culto || '').split('T')[0];
    if (!dataRaw) return new Date(0);

    const horaRaw = String(rodizio?.hora_culto || '00:00');
    const hora = horaRaw.length >= 8 ? horaRaw.slice(0, 8) : `${horaRaw.slice(0, 5)}:00`;
    const dateTime = new Date(`${dataRaw}T${hora}`);

    if (!Number.isNaN(dateTime.getTime())) return dateTime;

    const fallback = new Date(rodizio?.data_culto);
    return Number.isNaN(fallback.getTime()) ? new Date(0) : fallback;
  };

  const getRodizioDateKey = (rodizio) => {
    const raw = String(rodizio?.data_culto || '').split('T')[0];
    if (raw) return raw;
    const date = getRodizioDateTime(rodizio);
    return Number.isNaN(date.getTime()) ? '' : toIsoDateLocal(date);
  };

  const getFuncaoLabel = (rodizio) => {
    if (normalizeText(rodizio?.funcao) === 'meia_hora') return 'Meia Hora';
    if (normalizeText(rodizio?.culto_tipo) === 'rjm') return 'RJM';
    return 'Culto';
  };

  const isCultoAtivo = (culto) => {
    const status = normalizeText(culto?.ativo);
    return !(status === '0' || status === 'false' || status === 'nao' || status === 'não');
  };

  const calculateCoverage = (rodizios, cultos, periodoInicio, periodoFim) => {
    const cultosFiltrados = cultos
      .filter((c) => !filtrosDashboard.igreja_id || String(c.igreja_id) === String(filtrosDashboard.igreja_id))
      .filter(isCultoAtivo);

    const cultosPorDia = cultosFiltrados.reduce((acc, culto) => {
      const diaKey = normalizeText(culto.dia_semana);
      if (!acc[diaKey]) acc[diaKey] = [];
      acc[diaKey].push(culto);
      return acc;
    }, {});

    const expected = new Set();
    const actual = new Set();

    const cursor = new Date(periodoInicio);
    cursor.setHours(0, 0, 0, 0);

    const end = new Date(periodoFim);
    end.setHours(23, 59, 59, 999);

    while (cursor <= end) {
      const dayName = DIA_SEMANA[cursor.getDay()];
      const dateKey = toIsoDateLocal(cursor);
      const cultosDoDia = cultosPorDia[dayName] || [];

      cultosDoDia.forEach((culto) => {
        const tipoCulto = normalizeText(culto.tipo);
        if (tipoCulto === 'rjm') {
          expected.add(`${dateKey}|${culto.id}|tocar_culto`);
        } else {
          expected.add(`${dateKey}|${culto.id}|meia_hora`);
          expected.add(`${dateKey}|${culto.id}|tocar_culto`);
        }
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    rodizios.forEach((r) => {
      const dateKey = getRodizioDateKey(r);
      if (!dateKey || !r.culto_id) return;
      const funcao = normalizeText(r.funcao) === 'meia_hora' ? 'meia_hora' : 'tocar_culto';
      actual.add(`${dateKey}|${r.culto_id}|${funcao}`);
    });

    let cobertas = 0;
    expected.forEach((key) => {
      if (actual.has(key)) cobertas++;
    });

    const esperadas = expected.size;
    const pct = esperadas > 0 ? Math.round((cobertas / esperadas) * 100) : 0;
    return { pct, esperadas, cobertas };
  };

  const calculateCultoTypeSummary = (rodizios) => {
    const summary = { culto: 0, meia_hora: 0, rjm: 0 };

    rodizios.forEach((r) => {
      if (normalizeText(r.funcao) === 'meia_hora') {
        summary.meia_hora++;
      } else if (normalizeText(r.culto_tipo) === 'rjm') {
        summary.rjm++;
      } else {
        summary.culto++;
      }
    });

    return summary;
  };

  const calculateConflitosMesmoHorario = (rodizios) => {
    const map = new Map();

    rodizios.forEach((r) => {
      const organistaKey = r.organista_id || normalizeText(r.organista_nome);
      const dataKey = getRodizioDateKey(r);
      const horaKey = String(r.hora_culto || '').slice(0, 5);
      if (!organistaKey || !dataKey || !horaKey) return;
      const key = `${organistaKey}|${dataKey}|${horaKey}`;
      map.set(key, (map.get(key) || 0) + 1);
    });

    let conflitos = 0;
    map.forEach((count) => {
      if (count > 1) conflitos += count - 1;
    });
    return conflitos;
  };

  const parseWebhookFailuresLast24h = (logs) => {
    if (!Array.isArray(logs) || logs.length === 0) return 0;
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);

    return logs.filter((item) => {
      const createdAt = item?.created_at || item?.timestamp || item?.data || null;
      const createdTime = createdAt ? new Date(createdAt).getTime() : 0;
      if (!createdTime || createdTime < cutoff) return false;

      const level = normalizeText(item?.nivel || item?.level || '');
      const rawText = [
        item?.mensagem,
        item?.message,
        typeof item?.meta === 'string' ? item.meta : JSON.stringify(item?.meta || ''),
        typeof item?.detalhes === 'string' ? item.detalhes : JSON.stringify(item?.detalhes || '')
      ].join(' ');
      const text = normalizeText(rawText);

      const temWebhook = text.includes('webhook');
      const temFalha = level === 'error' || level === 'warn' || text.includes('erro') || text.includes('falha') || text.includes('failed');
      return temWebhook && temFalha;
    }).length;
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const periodoMeses = Number(filtrosDashboard.periodo_meses || 6);
      const agora = new Date();
      const proximos7Dias = new Date();
      proximos7Dias.setDate(agora.getDate() + 7);
      const periodoInicio = new Date();
      periodoInicio.setMonth(agora.getMonth() - periodoMeses);

      const periodoInicioIso = toIsoDateLocal(periodoInicio);
      const periodoFimIso = toIsoDateLocal(proximos7Dias);

      const [organistasRes, igrejasRes, cultosRes] = await Promise.all([
        getOrganistas(),
        getIgrejas(),
        getCultos()
      ]);

      let metricsRes = null;
      if (user?.role === 'admin') {
        try {
          metricsRes = await getMetrics();
        } catch (error) {
          console.warn('Erro ao buscar metricas:', error);
        }
      }

      const organistas = Array.isArray(organistasRes.data) ? organistasRes.data : [];
      const igrejasData = Array.isArray(igrejasRes.data) ? igrejasRes.data : [];
      const cultos = Array.isArray(cultosRes.data) ? cultosRes.data : [];
      setIgrejas(igrejasData);

      let rodizios = [];
      try {
        const params = {
          periodo_inicio: periodoInicioIso,
          periodo_fim: periodoFimIso
        };
        if (filtrosDashboard.igreja_id) params.igreja_id = filtrosDashboard.igreja_id;

        const rodiziosRes = await getRodizios(params);
        rodizios = Array.isArray(rodiziosRes.data) ? rodiziosRes.data : (Array.isArray(rodiziosRes) ? rodiziosRes : []);
      } catch (error) {
        console.warn('Erro ao buscar rodizios com filtro:', error);
        rodizios = [];
      }

      const rodiziosProximos = rodizios
        .filter((r) => {
          const dt = getRodizioDateTime(r);
          return dt >= agora && dt <= proximos7Dias;
        })
        .sort((a, b) => getRodizioDateTime(a) - getRodizioDateTime(b))
        .slice(0, 5);

      const ultimasAtividadesData = rodizios
        .filter((r) => getRodizioDateTime(r) <= agora)
        .sort((a, b) => getRodizioDateTime(b) - getRodizioDateTime(a))
        .slice(0, 5);

      const rodiziosPorMesData = {};
      rodizios.forEach((r) => {
        const dt = getRodizioDateTime(r);
        if (Number.isNaN(dt.getTime())) return;
        const mes = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        rodiziosPorMesData[mes] = (rodiziosPorMesData[mes] || 0) + 1;
      });

      const rodiziosPorMesArray = Object.entries(rodiziosPorMesData)
        .map(([mes, total]) => ({ mes, total }))
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .slice(-6);

      const cobertura = calculateCoverage(rodizios, cultos, periodoInicio, agora);
      const tipoCulto = calculateCultoTypeSummary(rodizios);
      const semTelefoneCount = rodizios.filter((r) => {
        if (getRodizioDateTime(r) < agora) return false;
        const phoneDigits = String(r.organista_telefone || '').replace(/\D/g, '');
        return phoneDigits.length < 10;
      }).length;
      const conflitosMesmoHorario = calculateConflitosMesmoHorario(rodizios);
      const proximoRodizio = rodiziosProximos[0] || null;

      let webhookFalhas24h = null;
      if (user?.role === 'admin') {
        try {
          const logsRes = await getLogs({ limit: 300, offset: 0 });
          const logs = Array.isArray(logsRes?.data?.logs) ? logsRes.data.logs : [];
          webhookFalhas24h = parseWebhookFailuresLast24h(logs);
        } catch (error) {
          webhookFalhas24h = null;
        }
      }

      setStats({
        organistas: organistas.length,
        igrejas: filtrosDashboard.igreja_id ? 1 : igrejasData.length,
        rodizios: rodizios.length,
        cultos: cultos.filter((c) => !filtrosDashboard.igreja_id || String(c.igreja_id) === String(filtrosDashboard.igreja_id)).length,
        rodiziosProximos
      });

      setRodiziosPorMes(rodiziosPorMesArray);
      setUltimasAtividades(ultimasAtividadesData);
      setInsights({
        coberturaPct: cobertura.pct,
        escalasEsperadas: cobertura.esperadas,
        escalasCobertas: cobertura.cobertas,
        tipoCulto,
        semTelefoneCount,
        conflitosMesmoHorario,
        webhookFalhas24h,
        proximoRodizio
      });
      setUltimaAtualizacao(new Date());

      if (user?.role === 'admin' && metricsRes?.data && !filtrosDashboard.igreja_id) {
        const metrics = metricsRes.data;
        setStats((prev) => ({
          ...prev,
          organistas: metrics.organistas?.total || prev.organistas,
          igrejas: metrics.igrejas?.total || prev.igrejas,
          rodizios: metrics.rodizios?.total || prev.rodizios
        }));
        if (metrics.rodizios?.por_mes) {
          setRodiziosPorMes(metrics.rodizios.por_mes.slice(-6));
        }
      }
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filtrosDashboard.igreja_id, filtrosDashboard.periodo_meses]);

  const handleTestarWebhook = async () => {
    try {
      setTestingWebhook(true);
      await testarWebhook();
      const checkedAt = new Date();
      setWebhookHealth({
        status: 'ok',
        message: 'Webhook testado com sucesso agora.',
        checkedAt
      });
      showSuccess('Webhook testado com sucesso.');
    } catch (error) {
      const checkedAt = new Date();
      setWebhookHealth({
        status: 'error',
        message: error.response?.data?.error || 'Falha ao testar webhook.',
        checkedAt
      });
      showError(getErrorMessage(error));
    } finally {
      setTestingWebhook(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando dashboard..." />;
  }

  const maxRodizios = rodiziosPorMes.length > 0
    ? Math.max(...rodiziosPorMes.map((r) => r.total))
    : 1;

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h1>Dashboard</h1>
        <p className="dashboard__subtitle">Visao geral do sistema</p>
      </div>

      <div className="dashboard__toolbar">
        <div className="dashboard__filter-group">
          <label htmlFor="dash-igreja">Igreja</label>
          <select
            id="dash-igreja"
            value={filtrosDashboard.igreja_id}
            onChange={(e) => setFiltrosDashboard((prev) => ({ ...prev, igreja_id: e.target.value }))}
          >
            <option value="">Todas</option>
            {igrejas.map((igreja) => (
              <option key={igreja.id} value={igreja.id}>{igreja.nome}</option>
            ))}
          </select>
        </div>
        <div className="dashboard__filter-group">
          <label htmlFor="dash-periodo">Periodo</label>
          <select
            id="dash-periodo"
            value={filtrosDashboard.periodo_meses}
            onChange={(e) => setFiltrosDashboard((prev) => ({ ...prev, periodo_meses: Number(e.target.value) }))}
          >
            <option value={1}>1 mes</option>
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </div>
        <button type="button" className="btn btn-secondary dashboard__refresh-btn" onClick={loadDashboardData}>
          Atualizar dados
        </button>
      </div>

      <div className="dashboard__kpi-grid">
        <div className="kpi-card kpi-card--organistas">
          <div className="kpi-card__content">
            <div className="kpi-card__label">Organistas</div>
            <div className="kpi-card__value">{stats.organistas}</div>
            <div className="kpi-card__meta">{stats.organistas} no periodo</div>
          </div>
          <div className="kpi-card__decor" aria-hidden="true">P</div>
        </div>

        <div className="kpi-card kpi-card--igrejas">
          <div className="kpi-card__content">
            <div className="kpi-card__label">Igrejas</div>
            <div className="kpi-card__value">{stats.igrejas}</div>
            <div className="kpi-card__meta">{stats.igrejas} no periodo</div>
          </div>
          <div className="kpi-card__decor" aria-hidden="true">I</div>
        </div>

        <div className="kpi-card kpi-card--rodizios">
          <div className="kpi-card__content">
            <div className="kpi-card__label">Rodizios</div>
            <div className="kpi-card__value">{stats.rodizios}</div>
            <div className="kpi-card__meta">{stats.rodizios} no periodo</div>
          </div>
          <div className="kpi-card__decor" aria-hidden="true">R</div>
        </div>

        <div className="kpi-card kpi-card--cultos">
          <div className="kpi-card__content">
            <div className="kpi-card__label">Cultos</div>
            <div className="kpi-card__value">{stats.cultos}</div>
            <div className="kpi-card__meta">{stats.cultos} no periodo</div>
          </div>
          <div className="kpi-card__decor" aria-hidden="true">C</div>
        </div>
      </div>

      <div className="dashboard__insights-grid">
        <div className="dashboard__card dashboard__card--compact">
          <h2 className="dashboard__card-title">Cobertura do Periodo</h2>
          <div className="insight-value">
            {insights.escalasEsperadas > 0 ? `${insights.coberturaPct}%` : '-'}
          </div>
          <div className="insight-meta">
            {insights.escalasCobertas} de {insights.escalasEsperadas} escalas esperadas preenchidas.
          </div>
        </div>

        <div className="dashboard__card dashboard__card--compact">
          <h2 className="dashboard__card-title">Distribuicao por Tipo</h2>
          <div className="type-badges">
            <span className="type-badge type-badge--culto">Culto: {insights.tipoCulto.culto}</span>
            <span className="type-badge type-badge--meia">Meia Hora: {insights.tipoCulto.meia_hora}</span>
            <span className="type-badge type-badge--rjm">RJM: {insights.tipoCulto.rjm}</span>
          </div>
        </div>

        <div className="dashboard__card dashboard__card--compact">
          <h2 className="dashboard__card-title">Alertas Operacionais</h2>
          <div className="alerts-list">
            <div className="alert-row">
              <strong>Proximo rodizio:</strong>
              <span>
                {insights.proximoRodizio
                  ? `${insights.proximoRodizio.organista_nome} - ${formatDate(insights.proximoRodizio.data_culto)} ${String(insights.proximoRodizio.hora_culto || '').slice(0, 5)}`
                  : 'Nenhum nos proximos 7 dias'}
              </span>
            </div>
            <div className="alert-row">
              <strong>Sem telefone:</strong>
              <span>{insights.semTelefoneCount}</span>
            </div>
            <div className="alert-row">
              <strong>Conflitos horario:</strong>
              <span>{insights.conflitosMesmoHorario}</span>
            </div>
            {user?.role === 'admin' && (
              <div className="alert-row">
                <strong>Falhas webhook (24h):</strong>
                <span>{insights.webhookFalhas24h === null ? 'N/D' : insights.webhookFalhas24h}</span>
              </div>
            )}
            <div className={`webhook-status webhook-status--${webhookHealth.status}`}>
              <span>{webhookHealth.message}</span>
              {webhookHealth.checkedAt && <small>{formatDateTime(webhookHealth.checkedAt)}</small>}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestarWebhook}
              disabled={testingWebhook}
            >
              {testingWebhook ? 'Testando...' : 'Testar webhook agora'}
            </button>
          </div>
        </div>

        <div className="dashboard__card dashboard__card--compact">
          <h2 className="dashboard__card-title">Acoes Rapidas</h2>
          <div className="quick-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/rodizios')}>Gerar Rodizio</button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/rodizios')}>Importar / Exportar CSV</button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/ciclos')}>Ajustar Ciclos</button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/escalas')}>Escalas e PDF</button>
            {(user?.role === 'admin' || user?.tipo_usuario === 'encarregado') && (
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/notificacoes-config')}>Configurar Envio</button>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard__content-grid">
        <div className="dashboard__card">
          <h2 className="dashboard__card-title">Rodizios por Mes</h2>
          <div className="chart-container">
            {rodiziosPorMes.length > 0 ? (
              <div className="chart-bars">
                {rodiziosPorMes.map((item, index) => {
                  const height = (item.total / maxRodizios) * 100;
                  return (
                    <div key={index} className="chart-bar-wrapper">
                      <div className="chart-bar" style={{ height: `${height}%` }}>
                        <span className="chart-bar__value">{item.total}</span>
                      </div>
                      <div className="chart-bar__label">
                        {new Date(`${item.mes}-01`).toLocaleDateString('pt-BR', { month: 'short' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="chart-empty">
                <p>Nenhum dado disponivel</p>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard__card">
          <h2 className="dashboard__card-title">Proximos Rodizios</h2>
          <div className="activities-list">
            {stats.rodiziosProximos.length > 0 ? (
              stats.rodiziosProximos.map((rodizio, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-item__icon">R</div>
                  <div className="activity-item__content">
                    <div className="activity-item__title">
                      {rodizio.organista_nome}
                      <span className="activity-item__badge">{getFuncaoLabel(rodizio)}</span>
                    </div>
                    <div className="activity-item__details">
                      {rodizio.igreja_nome} - {formatDate(rodizio.data_culto)} - {String(rodizio.hora_culto || '').slice(0, 5)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="activities-empty">
                <p>Nenhum rodizio agendado para os proximos 7 dias</p>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard__card dashboard__card--full">
          <h2 className="dashboard__card-title">Ultimas Atividades</h2>
          <div className="activities-list">
            {ultimasAtividades.length > 0 ? (
              ultimasAtividades.map((rodizio, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-item__icon">OK</div>
                  <div className="activity-item__content">
                    <div className="activity-item__title">
                      {rodizio.organista_nome} {getRodizioDateTime(rodizio) > new Date() ? 'ira tocar' : 'tocou'} em {rodizio.igreja_nome}
                    </div>
                    <div className="activity-item__details">
                      {formatDate(rodizio.data_culto)} - {String(rodizio.hora_culto || '').slice(0, 5)} - {getFuncaoLabel(rodizio)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="activities-empty">
                <p>Nenhuma atividade recente</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard__footer-meta">
        Ultima atualizacao: {ultimaAtualizacao ? formatDateTime(ultimaAtualizacao) : '-'}
      </div>

      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
}

export default Home;
