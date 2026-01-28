import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIgrejas, getRodizioPDF } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function Relatorios({ user }) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [igrejas, setIgrejas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    igreja_id: '',
    periodo_inicio: '',
    periodo_fim: ''
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadIgrejas();
  }, []);

  const loadIgrejas = async () => {
    try {
      setLoading(true);
      // Buscar apenas igrejas do usuário (encarregado, examinadora ou instrutoras)
      const response = await getIgrejas();
      // Filtrar apenas as igrejas associadas ao usuário
      const igrejasUsuario = JSON.parse(localStorage.getItem('igrejas') || '[]');
      const igrejasIds = igrejasUsuario.map(i => i.id);
      const igrejasFiltradas = response.data.filter(i => igrejasIds.includes(i.id));
      setIgrejas(igrejasFiltradas);
    } catch (error) {
      // Não fazer logout em caso de erro, apenas mostrar mensagem
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao carregar igrejas';
      if (error.response?.status === 401) {
        // Se for erro de autenticação, redirecionar para login usando navigate
        navigate('/login', { replace: true });
        return;
      }
      showAlert(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleGerarPDF = async (igrejaId) => {
    if (!igrejaId) {
      showAlert('Selecione uma igreja para gerar o PDF', 'error');
      return;
    }
    
    try {
      const response = await getRodizioPDF(
        igrejaId,
        filtros.periodo_inicio || null,
        filtros.periodo_fim || null
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const igrejaNome = igrejas.find(i => i.id === parseInt(igrejaId))?.nome || 'igreja';
      link.setAttribute('download', `rodizio_${igrejaNome.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      showAlert('PDF gerado com sucesso!');
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao gerar PDF';
      showAlert(errorMessage, 'error');
    }
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  const tipoUsuario = authUser?.tipo_usuario || '';
  const tipoTexto = tipoUsuario === 'encarregado' ? 'Encarregado' 
    : tipoUsuario === 'examinadora' ? 'Examinadora' 
    : tipoUsuario === 'instrutoras' ? 'Instrutoras' 
    : 'Usuário';

  return (
    <div>
      <div className="card">
        <h2>📊 Relatórios - {tipoTexto}</h2>
        <p className="lead">
          Visualize as igrejas que você cadastrou e gere relatórios em PDF por igreja.
        </p>

        {alert && (
          <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
            {alert.message}
          </div>
        )}

        <div className="btn-row btn-row--no-margin">
          <div className="form-group form-group--flex">
            <label>Filtrar por Igreja</label>
            <select
              value={filtros.igreja_id}
              onChange={(e) => setFiltros({ ...filtros, igreja_id: e.target.value })}
            >
              <option value="">Todas as igrejas</option>
              {igrejas.map(igreja => (
                <option key={igreja.id} value={igreja.id}>
                  {igreja.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group form-group--flex-sm">
            <label>Período Início</label>
            <input
              type="date"
              value={filtros.periodo_inicio}
              onChange={(e) => setFiltros({ ...filtros, periodo_inicio: e.target.value })}
            />
          </div>
          <div className="form-group form-group--flex-sm">
            <label>Período Fim</label>
            <input
              type="date"
              value={filtros.periodo_fim}
              onChange={(e) => setFiltros({ ...filtros, periodo_fim: e.target.value })}
            />
          </div>
        </div>

        {igrejas.length === 0 ? (
          <div className="empty">Nenhuma igreja cadastrada para você</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Igreja</th>
                  <th>Endereço</th>
                  <th>Organistas</th>
                  <th>Cultos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {igrejas
                  .filter(igreja => !filtros.igreja_id || igreja.id.toString() === filtros.igreja_id)
                  .map(igreja => (
                    <tr key={igreja.id}>
                      <td className="td-strong">{igreja.nome}</td>
                      <td>{igreja.endereco || '-'}</td>
                      <td>{igreja.total_organistas || 0}</td>
                      <td>{igreja.total_cultos || 0}</td>
                      <td>
                        <button
                          className="btn btn-success btn-nowrap"
                          onClick={() => handleGerarPDF(igreja.id)}
                        >
                          📄 Gerar PDF
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Relatorios;
