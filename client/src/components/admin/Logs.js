import React, { useState, useEffect } from 'react';
import { getLogs, clearLogs } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import { getErrorMessage } from '../../utils/errorMessages';
import useToast from '../../hooks/useToast';
import Toast from '../Toast';
import './Logs.css';

function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nivel, setNivel] = useState('');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const { toast, showSuccess, showError, hideToast } = useToast();

  useEffect(() => {
    loadLogs();
  }, [nivel, offset]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = { limit, offset };
      if (nivel) params.nivel = nivel;
      const res = await getLogs(params);
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Tem certeza que deseja limpar os logs antigos (mais de 30 dias)?')) {
      return;
    }
    try {
      await clearLogs(30);
      showSuccess('Logs antigos removidos com sucesso!');
      loadLogs();
    } catch (error) {
      showError(getErrorMessage(error));
    }
  };

  const getNivelBadgeClass = (nivel) => {
    switch (nivel) {
      case 'ERROR':
        return 'badge-danger';
      case 'WARN':
        return 'badge-warning';
      case 'INFO':
        return 'badge-info';
      case 'DEBUG':
        return 'badge-secondary';
      default:
        return 'badge-secondary';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="logs">
      <div className="card">
        <div className="logs__header">
          <h2>Logs do Sistema</h2>
          <div className="logs__header-actions">
            <button className="btn btn-secondary" onClick={loadLogs}>
              🔄 Atualizar
            </button>
            <button className="btn btn-warning" onClick={handleClearLogs}>
              🗑️ Limpar Logs Antigos
            </button>
          </div>
        </div>

        <div className="logs__filters">
          <select
            value={nivel}
            onChange={(e) => { setNivel(e.target.value); setOffset(0); }}
            className="form-group select"
          >
            <option value="">Todos os níveis</option>
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
            <option value="INFO">INFO</option>
            <option value="DEBUG">DEBUG</option>
          </select>
        </div>

        {loading ? (
          <LoadingSpinner message="Carregando logs..." />
        ) : (
          <>
            <div className="logs__info">
              <span>Total: {total} logs</span>
              <span>Página {currentPage} de {totalPages}</span>
            </div>

            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Data</th>
                    <th>Nível</th>
                    <th>Mensagem</th>
                    <th>Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>{formatDate(log.created_at)}</td>
                      <td>
                        <span className={`badge ${getNivelBadgeClass(log.nivel)}`}>
                          {log.nivel}
                        </span>
                      </td>
                      <td>{log.mensagem}</td>
                      <td>
                        {log.meta ? (
                          <details>
                            <summary>Ver detalhes</summary>
                            <pre>{JSON.stringify(log.meta, null, 2)}</pre>
                          </details>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {logs.length === 0 && (
              <div className="empty">
                <p>Nenhum log encontrado</p>
              </div>
            )}

            {totalPages > 1 && (
              <div className="logs__pagination">
                <button
                  className="btn btn-secondary"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                >
                  ← Anterior
                </button>
                <span>Página {currentPage} de {totalPages}</span>
                <button
                  className="btn btn-secondary"
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
}

export default Logs;
