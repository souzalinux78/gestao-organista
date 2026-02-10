import React, { useState, useEffect } from 'react';
import { getMetrics } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import { getErrorMessage } from '../../utils/errorMessages';
import useToast from '../../hooks/useToast';
import Toast from '../Toast';
import './Metrics.css';

function Metrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast, showError, hideToast } = useToast();

  useEffect(() => {
    loadMetrics();
    // Atualizar métricas a cada 30 segundos
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const res = await getMetrics();
      setMetrics(res.data);
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !metrics) {
    return <LoadingSpinner fullScreen message="Carregando métricas..." />;
  }

  if (!metrics) {
    return (
      <div className="card">
        <p>Nenhuma métrica disponível</p>
      </div>
    );
  }

  return (
    <div className="metrics">
      <div className="card">
        <div className="metrics__header">
          <h2>Métricas do Sistema</h2>
          <button className="btn btn-secondary" onClick={loadMetrics}>
            🔄 Atualizar
          </button>
        </div>

        <div className="metrics__grid">
          <div className="metric-card">
            <div className="metric-card__icon">👥</div>
            <div className="metric-card__content">
              <div className="metric-card__value">{metrics.usuarios.total}</div>
              <div className="metric-card__label">Total de Usuários</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-card__icon">🏢</div>
            <div className="metric-card__content">
              <div className="metric-card__value">{metrics.igrejas.total}</div>
              <div className="metric-card__label">Total de Igrejas</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-card__icon">🎹</div>
            <div className="metric-card__content">
              <div className="metric-card__value">{metrics.organistas.total}</div>
              <div className="metric-card__label">Total de Organistas</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-card__icon">📅</div>
            <div className="metric-card__content">
              <div className="metric-card__value">{metrics.rodizios.total}</div>
              <div className="metric-card__label">Total de Rodízios</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-card__icon">🏢</div>
            <div className="metric-card__content">
              <div className="metric-card__value">{metrics.tenants.total}</div>
              <div className="metric-card__label">Total de Tenants</div>
            </div>
          </div>
        </div>

        <div className="metrics__sections">
          <div className="metrics__section">
            <h3>Usuários por Role</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.usuarios.por_role.map(item => (
                    <tr key={item.role}>
                      <td>{item.role}</td>
                      <td>{item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="metrics__section">
            <h3>Status de Aprovação</h3>
            <div className="metrics__approval">
              <div className="metrics__approval-item">
                <span className="badge badge-success">Aprovados</span>
                <span className="metrics__approval-value">{metrics.usuarios.aprovacao.aprovados}</span>
              </div>
              <div className="metrics__approval-item">
                <span className="badge badge-warning">Pendentes</span>
                <span className="metrics__approval-value">{metrics.usuarios.aprovacao.pendentes}</span>
              </div>
            </div>
          </div>

          <div className="metrics__section">
            <h3>Usuários por Tenant</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Usuários</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.tenants.usuarios_por_tenant.map(item => (
                    <tr key={item.id}>
                      <td>{item.nome} ({item.slug})</td>
                      <td>{item.total_usuarios}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="metrics__section">
            <h3>Rodízios por Mês (Últimos 6 meses)</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.rodizios.por_mes.map(item => (
                    <tr key={item.mes}>
                      <td>{item.mes}</td>
                      <td>{item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
}

export default Metrics;
