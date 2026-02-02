import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRodizios, gerarRodizio, getRodizioPDF, getDiagnosticoIgreja, limparRodiziosIgreja, testarWebhook, updateRodizio, importarRodizio } from '../services/api';
import { getIgrejas, getCultosIgreja, getOrganistasIgreja } from '../services/api';
import { formatarDataBrasileira, parseDataBrasileira, aplicarMascaraData, validarDataBrasileira } from '../utils/dateHelpers';

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
    periodo_meses: 6,
    ciclo_inicial: '',
    data_inicial: '',
    organista_inicial: ''
  });
  const [arquivoCSV, setArquivoCSV] = useState(null);
  const [loadingImportar, setLoadingImportar] = useState(false);
  const [cultosIgreja, setCultosIgreja] = useState([]);
  const [organistasIgreja, setOrganistasIgreja] = useState([]);
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

  // Carregar cultos e organistas quando a igreja for selecionada
  useEffect(() => {
    if (gerarForm.igreja_id) {
      loadCultosIgreja(gerarForm.igreja_id);
      loadOrganistasIgreja(gerarForm.igreja_id);
    } else {
      setCultosIgreja([]);
      setOrganistasIgreja([]);
      setGerarForm(prev => ({ ...prev, ciclo_inicial: '', organista_inicial: '' }));
    }
  }, [gerarForm.igreja_id]);

  const loadCultosIgreja = async (igrejaId) => {
    try {
      const response = await getCultosIgreja(igrejaId);
      const cultosAtivos = response.data.filter(c => c.ativo === 1);
      setCultosIgreja(cultosAtivos);
      // Se houver apenas 1 ciclo, definir como padrão
      if (cultosAtivos.length === 1 && !gerarForm.ciclo_inicial) {
        setGerarForm(prev => ({ ...prev, ciclo_inicial: '1' }));
      }
    } catch (error) {
      console.error('Erro ao carregar cultos da igreja:', error);
      setCultosIgreja([]);
    }
  };

  const loadOrganistasIgreja = async (igrejaId) => {
    try {
      const response = await getOrganistasIgreja(igrejaId);
      setOrganistasIgreja(response.data);
    } catch (error) {
      console.error('Erro ao carregar organistas da igreja:', error);
      setOrganistasIgreja([]);
    }
  };

  const [editandoRodizio, setEditandoRodizio] = useState(null);
  const [organistaEditando, setOrganistaEditando] = useState('');

  const handleIniciarEdicao = async (rodizio) => {
    // Carregar organistas da igreja se necessário
    if (organistasIgreja.length === 0 && rodizio.igreja_id) {
      await loadOrganistasIgreja(rodizio.igreja_id);
    }
    setEditandoRodizio(rodizio.id);
    setOrganistaEditando(rodizio.organista_id.toString());
  };

  const handleCancelarEdicao = () => {
    setEditandoRodizio(null);
    setOrganistaEditando('');
  };

  const handleSalvarEdicao = async (rodizioId) => {
    if (!organistaEditando) {
      showAlert('Selecione uma organista', 'error');
      return;
    }

    try {
      await updateRodizio(rodizioId, parseInt(organistaEditando));
      showAlert('Rodízio atualizado com sucesso!');
      setEditandoRodizio(null);
      setOrganistaEditando('');
      loadRodizios();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Erro ao atualizar rodízio';
      showAlert(errorMessage, 'error');
    }
  };

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
      const cicloInicial = gerarForm.ciclo_inicial && gerarForm.ciclo_inicial !== '' 
        ? parseInt(gerarForm.ciclo_inicial) 
        : 1;
      const response = await gerarRodizio(
        parseInt(gerarForm.igreja_id), 
        gerarForm.periodo_meses, 
        cicloInicial,
        gerarForm.data_inicial || null,
        gerarForm.organista_inicial ? parseInt(gerarForm.organista_inicial) : null
      );
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
    
    if (!gerarForm.ciclo_inicial || gerarForm.ciclo_inicial === '') {
      showAlert('Selecione o ciclo inicial', 'error');
      return;
    }
    
    try {
      setLoadingGerar(true);
      // Converter data_inicial de dd/mm/yyyy para YYYY-MM-DD se necessário
      let dataInicialFormatada = gerarForm.data_inicial;
      if (dataInicialFormatada && dataInicialFormatada.includes('/')) {
        try {
          dataInicialFormatada = parseDataBrasileira(dataInicialFormatada);
        } catch (error) {
          showAlert('Data inicial inválida. Use o formato dd/mm/yyyy', 'error');
          return;
        }
      }
      
      const response = await gerarRodizio(
        parseInt(gerarForm.igreja_id), 
        gerarForm.periodo_meses,
        parseInt(gerarForm.ciclo_inicial),
        dataInicialFormatada || null,
        gerarForm.organista_inicial ? parseInt(gerarForm.organista_inicial) : null
      );
      showAlert(`Rodízio gerado com sucesso! ${response.data.rodizios} rodízios criados.`);
      setGerarForm({ igreja_id: '', periodo_meses: 6, ciclo_inicial: '', data_inicial: '', organista_inicial: '' });
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

  // Usar função padronizada de formatação de data (dd/mm/yyyy)
  const formatarData = (dataStr) => {
    return formatarDataBrasileira(dataStr);
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
              <div className="callout">
                <strong className="callout__title">🔧 Como resolver:</strong>
                <ol className="callout__list">
                  <li>Vá em <strong>"Igrejas"</strong> no menu superior</li>
                  <li>Encontre a igreja <strong>"{igrejas.find(i => i.id.toString() === gerarForm.igreja_id)?.nome || 'selecionada'}"</strong></li>
                  <li>Clique no botão verde <strong>"Organistas"</strong> na coluna "Ações"</li>
                  <li>No modal, selecione a organista no dropdown</li>
                  <li>Ela será adicionada automaticamente à igreja</li>
                </ol>
                <div className="callout__actions">
                  <button onClick={() => navigate('/igrejas')} className="btn btn-primary">
                    Ir para Igrejas →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        <form onSubmit={handleGerarRodizio} className="form--spaced">
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
                className="input-readonly"
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
          <div className="form-group">
            <label>Data Inicial</label>
            <input
              type="text"
              placeholder="dd/mm/yyyy"
              value={gerarForm.data_inicial}
              onChange={(e) => {
                const valorComMascara = aplicarMascaraData(e.target.value);
                setGerarForm({ ...gerarForm, data_inicial: valorComMascara });
              }}
              maxLength={10}
            />
            <small className="form-hint">
              Selecione a data a partir da qual deseja gerar o rodízio. Se deixar em branco, começará a partir de hoje.
            </small>
          </div>
          {gerarForm.igreja_id && organistasIgreja.length > 0 && (
            <div className="form-group">
              <label>Organista Inicial</label>
              <select
                value={gerarForm.organista_inicial}
                onChange={(e) => setGerarForm({ ...gerarForm, organista_inicial: e.target.value })}
              >
                <option value="">Começar pela primeira organista da sequência</option>
                {organistasIgreja.map((organista, index) => (
                  <option key={organista.id} value={index}>
                    {index + 1} - {organista.nome}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                Escolha qual organista da sequência deseja começar. Se deixar em branco, começará pela primeira.
              </small>
            </div>
          )}
          {gerarForm.igreja_id && cultosIgreja.length > 0 && (
            <div className="form-group">
              <label>Ciclo Inicial *</label>
              <select
                value={gerarForm.ciclo_inicial}
                onChange={(e) => setGerarForm({ ...gerarForm, ciclo_inicial: e.target.value })}
                required
              >
                <option value="">Selecione o ciclo inicial</option>
                {Array.from({ length: cultosIgreja.length }, (_, i) => i + 1).map(ciclo => (
                  <option key={ciclo} value={ciclo}>
                    Ciclo {ciclo}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                Esta igreja tem {cultosIgreja.length} culto(s) cadastrado(s). Escolha de qual ciclo começar (1 a {cultosIgreja.length}).
                <br />
                <strong>Exemplo:</strong> Se escolher Ciclo 2, o rodízio começará invertendo os 2 primeiros organistas.
              </small>
            </div>
          )}
          <div className="btn-row">
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
            >
              {loadingWebhook ? 'Testando...' : '🔔 Testar Webhook'}
            </button>
          </div>
        </form>

        {/* Seção de Importação de Rodízio */}
        <div className="form-section" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb' }}>
          <h3>Importar Rodízio (CSV)</h3>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Importe um rodízio já definido usando um arquivo CSV. O sistema não substituirá rodízios existentes, apenas adicionará novos.
          </p>
          
          <div className="form-group">
            <label>Arquivo CSV *</label>
            <input
              id="csv-import-input"
              type="file"
              accept=".csv"
              onChange={(e) => setArquivoCSV(e.target.files[0] || null)}
              style={{ marginBottom: '0.5rem' }}
            />
            <small className="form-hint">
              <strong>Formato esperado:</strong> CSV com cabeçalho: igreja_id, data_culto, dia_semana, hora_culto, organista_id, funcao<br />
              <strong>Data:</strong> Formato brasileiro (dd/mm/yyyy)<br />
              <strong>Função:</strong> meia_hora ou tocar_culto<br />
              <strong>Exemplo:</strong><br />
              <code style={{ display: 'block', marginTop: '0.5rem', padding: '0.5rem', background: '#f3f4f6', borderRadius: '4px', fontSize: '0.85rem' }}>
                igreja_id,data_culto,dia_semana,hora_culto,organista_id,funcao<br />
                1,15/01/2024,segunda,19:00:00,5,meia_hora<br />
                1,15/01/2024,segunda,19:30:00,3,tocar_culto
              </code>
            </small>
          </div>
          
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleImportarRodizio}
              disabled={loadingImportar || !arquivoCSV || !gerarForm.igreja_id}
            >
              {loadingImportar ? 'Importando...' : '📥 Importar Rodízio (CSV)'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Rodízios</h2>
        
        <div className="btn-row btn-row--no-margin">
          {user?.role === 'admin' ? (
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
          ) : null}
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
          {filtros.igreja_id && (
            <button className="btn btn-success btn-nowrap" onClick={handleGerarPDF}>
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
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rodizios.map(rodizio => (
                  <tr key={rodizio.id}>
                    <td className="td-strong table__nowrap">{formatarData(rodizio.data_culto)}</td>
                    <td className="text-capitalize">{rodizio.dia_semana}</td>
                    <td className="table__nowrap">
                      {rodizio.hora_culto ? (rodizio.hora_culto.includes(':') ? rodizio.hora_culto.split(':').slice(0, 2).join(':') : rodizio.hora_culto) : '-'}
                    </td>
                    <td>
                      <span className={`badge ${rodizio.funcao === 'meia_hora' ? 'badge--warn' : 'badge--info'}`}>
                        {rodizio.funcao === 'meia_hora' ? '🎵 Meia Hora' : '🎹 Tocar no Culto'}
                      </span>
                    </td>
                    <td className="table__cell--break">
                      {editandoRodizio === rodizio.id ? (
                        <select
                          value={organistaEditando}
                          onChange={(e) => setOrganistaEditando(e.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {organistasIgreja.map(org => (
                            <option key={org.id} value={org.id}>
                              {org.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        rodizio.organista_nome
                      )}
                    </td>
                    <td>{rodizio.organista_telefone || '-'}</td>
                    <td>
                      {editandoRodizio === rodizio.id ? (
                        <div className="btn-row btn-row--no-margin actions-inline">
                          <button
                            className="btn btn-success"
                            onClick={() => handleSalvarEdicao(rodizio.id)}
                          >
                            ✓ Salvar
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={handleCancelarEdicao}
                          >
                            ✕ Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={(event) => {
                            event.preventDefault();
                            // Carregar organistas da igreja se necessário
                            if (organistasIgreja.length === 0 && rodizio.igreja_id) {
                              loadOrganistasIgreja(rodizio.igreja_id);
                            }
                            handleIniciarEdicao(rodizio);
                          }}
                        >
                          ✏️ Editar
                        </button>
                      )}
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

export default Rodizios;
