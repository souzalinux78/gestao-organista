import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRodizios, gerarRodizio, getRodizioPDF, getDiagnosticoIgreja, limparRodiziosIgreja, testarWebhook } from '../services/api';
import { getIgrejas } from '../services/api';

function Rodizios({ user }) {
  const navigate = useNavigate();
  const [rodizios, setRodizios] = useState([]);
  const [igrejas, setIgrejas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [filtros, setFiltros] = useState({
    igreja_id: '',
    periodo_inicio: '',
    periodo_fim: ''
  });
  const [gerarForm, setGerarForm] = useState({
    igreja_id: '',
    periodo_meses: 6
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadIgrejas();
    loadRodizios();
  }, []);

  useEffect(() => {
    // Se usuário comum tem apenas 1 igreja, selecionar automaticamente
    if (user?.role !== 'admin' && igrejas.length === 1) {
      setGerarForm(prev => ({ ...prev, igreja_id: igrejas[0].id.toString() }));
      setFiltros(prev => ({ ...prev, igreja_id: igrejas[0].id.toString() }));
    }
  }, [igrejas, user]);

  const loadIgrejas = async () => {
    try {
      const response = await getIgrejas();
      setIgrejas(response.data);
    } catch (error) {
      console.error('Erro ao carregar igrejas:', error);
    }
  };

  const loadRodizios = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filtros.igreja_id) params.igreja_id = filtros.igreja_id;
      if (filtros.periodo_inicio) params.periodo_inicio = filtros.periodo_inicio;
      if (filtros.periodo_fim) params.periodo_fim = filtros.periodo_fim;
      
      const response = await getRodizios(params);
      setRodizios(response.data);
    } catch (error) {
      showAlert('Erro ao carregar rodízios', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRodizios();
  }, [filtros.igreja_id, filtros.periodo_inicio, filtros.periodo_fim]);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleLimparRodizios = async () => {
    if (!gerarForm.igreja_id) {
      showAlert('Selecione uma igreja para limpar os rodízios', 'error');
      return;
    }
    
    const confirmar = window.confirm(
      `Tem certeza que deseja limpar TODOS os rodízios da igreja "${igrejas.find(i => i.id.toString() === gerarForm.igreja_id)?.nome}"?\n\n` +
      `Esta ação não pode ser desfeita!`
    );
    
    if (!confirmar) return;
    
    try {
      setLoadingGerar(true);
      const response = await limparRodiziosIgreja(gerarForm.igreja_id);
      showAlert(response.data.message || 'Rodízios limpos com sucesso!');
      loadRodizios();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Erro ao limpar rodízios';
      showAlert(errorMessage, 'error');
    } finally {
      setLoadingGerar(false);
    }
  };

  const handleTestarWebhook = async () => {
    try {
      setLoadingWebhook(true);
      const response = await testarWebhook();
      showAlert(
        `Webhook testado com sucesso!\n\n` +
        `Organista: ${response.data.detalhes.organista}\n` +
        `Data: ${response.data.detalhes.data}\n` +
        `Hora: ${response.data.detalhes.hora}\n` +
        `Função: ${response.data.detalhes.funcao === 'meia_hora' ? 'Meia Hora' : 'Tocar no Culto'}\n` +
        `Igreja: ${response.data.detalhes.igreja}`,
        'success'
      );
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Erro ao testar webhook';
      showAlert(errorMessage, 'error');
    } finally {
      setLoadingWebhook(false);
    }
  };

  const handleLimparERefazer = async () => {
    if (!gerarForm.igreja_id) {
      showAlert('Selecione uma igreja', 'error');
      return;
    }
    
    const confirmar = window.confirm(
      `Deseja limpar os rodízios existentes e gerar um novo rodízio para ${gerarForm.periodo_meses} meses?\n\n` +
      `Todos os rodízios atuais serão deletados e um novo será criado.`
    );
    
    if (!confirmar) return;
    
    try {
      setLoadingGerar(true);
      
      // Primeiro limpar
      await limparRodiziosIgreja(gerarForm.igreja_id);
      
      // Depois gerar novo
      const response = await gerarRodizio(parseInt(gerarForm.igreja_id), gerarForm.periodo_meses);
      showAlert(`Rodízio limpo e regenerado com sucesso! ${response.data.rodizios} rodízios criados.`);
      loadRodizios();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Erro ao limpar e refazer rodízio';
      showAlert(errorMessage, 'error');
    } finally {
      setLoadingGerar(false);
    }
  };

  const handleGerarRodizio = async (e) => {
    e.preventDefault();
    if (!gerarForm.igreja_id) {
      showAlert('Selecione uma igreja', 'error');
      return;
    }
    
    try {
      setLoadingGerar(true);
      const response = await gerarRodizio(parseInt(gerarForm.igreja_id), gerarForm.periodo_meses);
      showAlert(`Rodízio gerado com sucesso! ${response.data.rodizios} rodízios criados.`);
      setGerarForm({ igreja_id: '', periodo_meses: 6 });
      loadRodizios();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Erro ao gerar rodízio';
      showAlert(errorMessage, 'error');
      
      // Se o erro for sobre organistas não associadas, mostrar link direto
      if (errorMessage.includes('organista oficializada associada')) {
        console.log('Erro: Organista não associada. Verifique o console do servidor para mais detalhes.');
      }
    } finally {
      setLoadingGerar(false);
    }
  };

  const handleGerarPDF = async () => {
    if (!filtros.igreja_id) {
      showAlert('Selecione uma igreja para gerar o PDF', 'error');
      return;
    }
    
    try {
      console.log('[DEBUG] Gerando PDF para igreja:', filtros.igreja_id);
      console.log('[DEBUG] Período:', filtros.periodo_inicio, 'a', filtros.periodo_fim);
      
      const response = await getRodizioPDF(
        filtros.igreja_id,
        filtros.periodo_inicio,
        filtros.periodo_fim
      );
      
      console.log('[DEBUG] PDF recebido, tamanho:', response.data.size);
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rodizio_${filtros.igreja_id}_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      // Limpar URL após download
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      
      showAlert('PDF gerado com sucesso!');
    } catch (error) {
      console.error('[DEBUG] Erro ao gerar PDF:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao gerar PDF';
      showAlert(errorMessage, 'error');
    }
  };

  const formatarData = (dataStr) => {
    if (!dataStr) return '-';
    
    try {
      // Se for uma string ISO (com T e Z)
      if (typeof dataStr === 'string' && dataStr.includes('T')) {
        const data = new Date(dataStr);
        if (isNaN(data.getTime())) {
          // Tentar parsear formato YYYY-MM-DD
          const partes = dataStr.split('T')[0].split('-');
          if (partes.length === 3) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
          }
          return dataStr;
        }
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        return `${dia}/${mes}/${ano}`;
      }
      
      // Se for formato YYYY-MM-DD
      if (typeof dataStr === 'string' && dataStr.includes('-') && !dataStr.includes('T')) {
        const [ano, mes, dia] = dataStr.split('-');
        if (ano && mes && dia) {
          return `${dia}/${mes}/${ano}`;
        }
      }
      
      // Se for um objeto Date
      if (dataStr instanceof Date) {
        const dia = String(dataStr.getDate()).padStart(2, '0');
        const mes = String(dataStr.getMonth() + 1).padStart(2, '0');
        const ano = dataStr.getFullYear();
        return `${dia}/${mes}/${ano}`;
      }
      
      return String(dataStr);
    } catch (error) {
      console.error('Erro ao formatar data:', error, dataStr);
      return String(dataStr);
    }
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <div>
      <div className="card">
        <h2>Gerar Rodízio</h2>
        {alert && (
          <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
            {alert.message}
            {alert.type === 'error' && alert.message.includes('organista oficializada associada') && gerarForm.igreja_id && (
              <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255,255,255,0.3)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.5)' }}>
                <strong style={{ display: 'block', marginBottom: '10px' }}>🔧 Como resolver:</strong>
                <ol style={{ margin: '5px 0 0 20px', padding: 0, lineHeight: '1.8' }}>
                  <li>Vá em <strong>"Igrejas"</strong> no menu superior</li>
                  <li>Encontre a igreja <strong>"{igrejas.find(i => i.id.toString() === gerarForm.igreja_id)?.nome || 'selecionada'}"</strong></li>
                  <li>Clique no botão verde <strong>"Organistas"</strong> na coluna "Ações"</li>
                  <li>No modal, selecione a organista no dropdown</li>
                  <li>Ela será adicionada automaticamente à igreja</li>
                </ol>
                <button 
                  onClick={() => navigate('/igrejas')}
                  className="btn btn-primary"
                  style={{ marginTop: '15px', fontSize: '14px' }}
                >
                  Ir para Igrejas →
                </button>
              </div>
            )}
          </div>
        )}
        
        <form onSubmit={handleGerarRodizio} style={{ marginTop: '20px' }}>
          {user?.role === 'admin' ? (
            <div className="form-group">
              <label>Igreja *</label>
              <select
                value={gerarForm.igreja_id}
                onChange={(e) => setGerarForm({ ...gerarForm, igreja_id: e.target.value })}
                required
              >
                <option value="">Selecione uma igreja...</option>
                {igrejas.map(igreja => (
                  <option key={igreja.id} value={igreja.id}>
                    {igreja.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label>Igreja</label>
              <input
                type="text"
                value={igrejas.find(i => i.id.toString() === gerarForm.igreja_id)?.nome || ''}
                disabled
                style={{ background: '#f5f5f5' }}
              />
            </div>
          )}
          <div className="form-group">
            <label>Período *</label>
            <select
              value={gerarForm.periodo_meses}
              onChange={(e) => setGerarForm({ ...gerarForm, periodo_meses: parseInt(e.target.value) })}
              required
            >
              <option value={3}>3 meses</option>
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={loadingGerar}>
              {loadingGerar ? 'Gerando...' : 'Gerar Rodízio'}
            </button>
            {gerarForm.igreja_id && (
              <>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleLimparERefazer}
                  disabled={loadingGerar}
                  style={{ background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', color: 'white' }}
                >
                  {loadingGerar ? 'Processando...' : '🗑️ Limpar e Refazer'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={handleLimparRodizios}
                  disabled={loadingGerar}
                >
                  {loadingGerar ? 'Limpando...' : '🗑️ Limpar Rodízios'}
                </button>
              </>
            )}
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleTestarWebhook}
              disabled={loadingWebhook || loadingGerar}
              style={{ background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)', color: 'white' }}
            >
              {loadingWebhook ? 'Testando...' : '🔔 Testar Webhook'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Rodízios</h2>
        
        <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {user?.role === 'admin' ? (
            <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
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
          ) : null}
          <div className="form-group" style={{ flex: '1', minWidth: '150px' }}>
            <label>Período Início</label>
            <input
              type="date"
              value={filtros.periodo_inicio}
              onChange={(e) => setFiltros({ ...filtros, periodo_inicio: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ flex: '1', minWidth: '150px' }}>
            <label>Período Fim</label>
            <input
              type="date"
              value={filtros.periodo_fim}
              onChange={(e) => setFiltros({ ...filtros, periodo_fim: e.target.value })}
            />
          </div>
          {filtros.igreja_id && (
            <button className="btn btn-success" onClick={handleGerarPDF}>
              📄 Gerar PDF
            </button>
          )}
        </div>

        {rodizios.length === 0 ? (
          <div className="empty">Nenhum rodízio encontrado</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Dia</th>
                  <th>Hora</th>
                  <th>Função</th>
                  <th>Organista</th>
                  <th>Telefone</th>
                </tr>
              </thead>
              <tbody>
                {rodizios.map(rodizio => (
                  <tr key={rodizio.id}>
                    <td style={{ fontWeight: '500', whiteSpace: 'nowrap' }}>{formatarData(rodizio.data_culto)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{rodizio.dia_semana}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {rodizio.hora_culto ? (rodizio.hora_culto.includes(':') ? rodizio.hora_culto.split(':').slice(0, 2).join(':') : rodizio.hora_culto) : '-'}
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: rodizio.funcao === 'meia_hora' 
                          ? 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)' 
                          : 'linear-gradient(135deg, #2E86AB 0%, #4A90E2 100%)',
                        color: 'white',
                        display: 'inline-block'
                      }}>
                        {rodizio.funcao === 'meia_hora' ? '🎵 Meia Hora' : '🎹 Tocar no Culto'}
                      </span>
                    </td>
                    <td>{rodizio.organista_nome}</td>
                    <td>{rodizio.organista_telefone || '-'}</td>
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

export default Rodizios;
