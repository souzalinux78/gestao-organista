import React, { useState, useEffect } from 'react';
import { getOrganistas, getIgrejas, getRodizios, getCultos, getMetrics } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { getErrorMessage } from '../utils/errorMessages';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './Home.css';

function Home() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    organistas: 0,
    igrejas: 0,
    rodizios: 0,
    cultos: 0,
    rodiziosProximos: []
  });
  const [rodiziosPorMes, setRodiziosPorMes] = useState([]);
  const [ultimasAtividades, setUltimasAtividades] = useState([]);
  const { toast, showError, hideToast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Buscar dados em paralelo
      const [organistasRes, igrejasRes, cultosRes] = await Promise.all([
        getOrganistas(),
        getIgrejas(),
        getCultos()
      ]);

      // Se for admin, buscar métricas também
      let metricsRes = null;
      if (user?.role === 'admin') {
        try {
          metricsRes = await getMetrics();
        } catch (error) {
          // Ignorar erro de métricas, usar dados normais
          console.warn('Erro ao buscar métricas:', error);
        }
      }

      const organistas = organistasRes.data || [];
      const igrejas = igrejasRes.data || [];
      const cultos = cultosRes.data || [];

      // Buscar rodízios (últimos 30 dias e próximos 7 dias)
      const hoje = new Date();
      const proximos7Dias = new Date();
      proximos7Dias.setDate(hoje.getDate() + 7);
      const ultimos30Dias = new Date();
      ultimos30Dias.setDate(hoje.getDate() - 30);

      let rodizios = [];
      try {
        const rodiziosRes = await getRodizios({
          periodo_inicio: ultimos30Dias.toISOString().split('T')[0],
          periodo_fim: proximos7Dias.toISOString().split('T')[0]
        });
        // A API retorna array diretamente ou dentro de data
        rodizios = Array.isArray(rodiziosRes.data) ? rodiziosRes.data : (Array.isArray(rodiziosRes) ? rodiziosRes : []);
      } catch (error) {
        // Se falhar, tentar buscar sem filtro de data
        try {
          const rodiziosRes = await getRodizios();
          rodizios = Array.isArray(rodiziosRes.data) ? rodiziosRes.data : (Array.isArray(rodiziosRes) ? rodiziosRes : []);
        } catch (err) {
          console.warn('Erro ao buscar rodízios:', err);
          rodizios = [];
        }
      }
      
      // Filtrar rodízios próximos (próximos 7 dias)
      const rodiziosProximos = rodizios
        .filter(r => {
          const dataCulto = new Date(r.data_culto);
          return dataCulto >= hoje && dataCulto <= proximos7Dias;
        })
        .sort((a, b) => new Date(a.data_culto) - new Date(b.data_culto))
        .slice(0, 5);

      // Agrupar rodízios por mês (últimos 6 meses)
      const rodiziosPorMesData = {};
      rodizios.forEach(r => {
        const data = new Date(r.data_culto);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        if (!rodiziosPorMesData[mes]) {
          rodiziosPorMesData[mes] = 0;
        }
        rodiziosPorMesData[mes]++;
      });

      const rodiziosPorMesArray = Object.entries(rodiziosPorMesData)
        .map(([mes, total]) => ({ mes, total }))
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .slice(-6);

      // Últimas atividades (rodízios recentes)
      const ultimasAtividadesData = rodizios
        .filter(r => {
          const dataCulto = new Date(r.data_culto);
          return dataCulto <= hoje;
        })
        .sort((a, b) => new Date(b.data_culto) - new Date(a.data_culto))
        .slice(0, 5);

      setStats({
        organistas: organistas.length,
        igrejas: igrejas.length,
        rodizios: rodizios.length,
        cultos: cultos.length,
        rodiziosProximos
      });

      setRodiziosPorMes(rodiziosPorMesArray);
      setUltimasAtividades(ultimasAtividadesData);

      // Se for admin e tiver métricas, usar dados de métricas
      if (user?.role === 'admin' && metricsRes?.data) {
        const metrics = metricsRes.data;
        setStats(prev => ({
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando dashboard..." />;
  }

  const maxRodizios = rodiziosPorMes.length > 0 
    ? Math.max(...rodiziosPorMes.map(r => r.total))
    : 1;

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h1>Dashboard</h1>
        <p className="dashboard__subtitle">Visão geral do sistema</p>
      </div>

      {/* Cards KPI */}
      <div className="dashboard__kpi-grid">
        <div className="kpi-card kpi-card--organistas">
          <div className="kpi-card__content">
            <div className="kpi-card__label">Organistas</div>
            <div className="kpi-card__value">{stats.organistas}</div>
            <div className="kpi-card__meta">{stats.organistas} no período</div>
          </div>
          <div className="kpi-card__decor" aria-hidden="true">🎹</div>
        </div>

        <div className="kpi-card kpi-card--igrejas">
          <div className="kpi-card__content">
            <div className="kpi-card__label">Igrejas</div>
            <div className="kpi-card__value">{stats.igrejas}</div>
            <div className="kpi-card__meta">{stats.igrejas} no período</div>
          </div>
          <div className="kpi-card__decor" aria-hidden="true">🏢</div>
        </div>

        <div className="kpi-card kpi-card--rodizios">
          <div className="kpi-card__content">
            <div className="kpi-card__label">Rodízios</div>
            <div className="kpi-card__value">{stats.rodizios}</div>
            <div className="kpi-card__meta">{stats.rodizios} no período</div>
          </div>
          <div className="kpi-card__decor" aria-hidden="true">📅</div>
        </div>

        <div className="kpi-card kpi-card--cultos">
          <div className="kpi-card__content">
            <div className="kpi-card__label">Cultos</div>
            <div className="kpi-card__value">{stats.cultos}</div>
            <div className="kpi-card__meta">{stats.cultos} no período</div>
          </div>
          <div className="kpi-card__decor" aria-hidden="true">📖</div>
        </div>
      </div>

      {/* Gráficos e Atividades */}
      <div className="dashboard__content-grid">
        {/* Gráfico de Rodízios por Mês */}
        <div className="dashboard__card">
          <h2 className="dashboard__card-title">Rodízios por Mês</h2>
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
                        {new Date(item.mes + '-01').toLocaleDateString('pt-BR', { month: 'short' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="chart-empty">
                <p>Nenhum dado disponível</p>
              </div>
            )}
          </div>
        </div>

        {/* Próximos Rodízios */}
        <div className="dashboard__card">
          <h2 className="dashboard__card-title">Próximos Rodízios</h2>
          <div className="activities-list">
            {stats.rodiziosProximos.length > 0 ? (
              stats.rodiziosProximos.map((rodizio, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-item__icon">📅</div>
                  <div className="activity-item__content">
                    <div className="activity-item__title">{rodizio.organista_nome}</div>
                    <div className="activity-item__details">
                      {rodizio.igreja_nome} • {formatDate(rodizio.data_culto)} • {rodizio.hora_culto}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="activities-empty">
                <p>Nenhum rodízio agendado para os próximos 7 dias</p>
              </div>
            )}
          </div>
        </div>

        {/* Últimas Atividades */}
        <div className="dashboard__card dashboard__card--full">
          <h2 className="dashboard__card-title">Últimas Atividades</h2>
          <div className="activities-list">
            {ultimasAtividades.length > 0 ? (
              ultimasAtividades.map((rodizio, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-item__icon">✓</div>
                  <div className="activity-item__content">
                    <div className="activity-item__title">
                      {rodizio.organista_nome} tocou em {rodizio.igreja_nome}
                    </div>
                    <div className="activity-item__details">
                      {formatDate(rodizio.data_culto)} • {rodizio.hora_culto} • {rodizio.funcao === 'meia_hora' ? 'Meia Hora' : 'Culto'}
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

      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
}

export default Home;
