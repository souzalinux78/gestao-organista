import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRodizios, gerarRodizio, refazerRodizio, getRodizioPDF, limparRodiziosIgreja, testarWebhook, updateRodizio, importarRodizio } from '../services/api';
import { getIgrejas, getCiclosIgreja, getOrganistasIgreja } from '../services/api';
import { formatarDataBrasileira, parseDataBrasileira, aplicarMascaraData } from '../utils/dateHelpers';
import { useAuth } from '../contexts/AuthContext';

function Rodizios({ user }) {
  const navigate = useNavigate();

  // CORREÇÃO: Hook chamado incondicionalmente (sempre executa)
  const { user: authUser } = useAuth();

  // Define quem é o usuário atual (o da prop ou o do contexto)
  const currentUser = user || authUser;

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
  const [ciclosIgreja, setCiclosIgreja] = useState([]);
  const [organistasIgreja, setOrganistasIgreja] = useState([]);
  const [alert, setAlert] = useState(null);

  // Estados de Edição na Tabela
  const [editandoRodizio, setEditandoRodizio] = useState(null);
  const [organistaEditando, setOrganistaEditando] = useState('');

  useEffect(() => {
    loadIgrejas();
    loadRodizios();
  }, []);

  useEffect(() => {
    if (currentUser?.role !== 'admin' && igrejas.length === 1) {
      setGerarForm(prev => ({ ...prev, igreja_id: igrejas[0].id.toString() }));
      setFiltros(prev => ({ ...prev, igreja_id: igrejas[0].id.toString() }));
    }
  }, [igrejas, currentUser]);

  useEffect(() => {
    if (gerarForm.igreja_id) {
      loadCiclosIgreja(gerarForm.igreja_id);
      loadOrganistasIgreja(gerarForm.igreja_id);
    } else {
      setCiclosIgreja([]);
      setOrganistasIgreja([]);
      setGerarForm(prev => ({ ...prev, ciclo_inicial: '', organista_inicial: '' }));
    }
  }, [gerarForm.igreja_id]);

  const loadCiclosIgreja = async (igrejaId) => {
    try {
      const response = await getCiclosIgreja(igrejaId);
      // O backend agora retorna { igreja_id, total_ciclos, ciclos: [...] }
      const listaCiclos = response.data.ciclos || [];
      setCiclosIgreja(listaCiclos);
      if (listaCiclos.length > 0 && !gerarForm.ciclo_inicial) {
        setGerarForm(prev => ({ ...prev, ciclo_inicial: listaCiclos[0].id.toString() }));
      }
    } catch (error) {
      console.error('Erro ao carregar ciclos:', error);
      setCiclosIgreja([]);
    }
  };

  const loadOrganistasIgreja = async (igrejaId) => {
    try {
      const response = await getOrganistasIgreja(igrejaId);
      // Ordenação alfabética para facilitar busca
      const lista = response.data.sort((a, b) => a.nome.localeCompare(b.nome));
      setOrganistasIgreja(lista);
    } catch (error) {
      console.error('Erro ao carregar organistas:', error);
      setOrganistasIgreja([]);
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

  // --- FUNÇÕES DE EDIÇÃO ---
  const handleIniciarEdicao = async (rodizio) => {
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
      showAlert('Erro ao atualizar rodízio', 'error');
    }
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleGerarRodizio = async (e) => {
    e.preventDefault();
    if (!gerarForm.igreja_id) { showAlert('Selecione uma igreja', 'error'); return; }
    if (!gerarForm.ciclo_inicial) { showAlert('Selecione o ciclo inicial', 'error'); return; }

    try {
      setLoadingGerar(true);
      let dataInicial = gerarForm.data_inicial;
      if (dataInicial && dataInicial.includes('/')) {
        dataInicial = parseDataBrasileira(dataInicial);
      }

      const response = await gerarRodizio(
        parseInt(gerarForm.igreja_id),
        gerarForm.periodo_meses,
        parseInt(gerarForm.ciclo_inicial),
        dataInicial || null,
        // Envia ID (inteiro) se houver
        gerarForm.organista_inicial ? parseInt(gerarForm.organista_inicial) : null
      );
      showAlert(`Sucesso! ${response.data.rodizios} escalas geradas.`);
      loadRodizios();
    } catch (error) {
      showAlert(error.response?.data?.error || 'Erro ao gerar rodízio', 'error');
    } finally {
      setLoadingGerar(false);
    }
  };

  const handleLimparRodizios = async () => {
    if (!gerarForm.igreja_id) { showAlert('Selecione uma igreja', 'error'); return; }
    if (!window.confirm('Tem certeza? Isso apagará toda a escala atual.')) return;

    try {
      setLoadingGerar(true);
      await limparRodiziosIgreja(gerarForm.igreja_id);
      showAlert('Rodízios limpos com sucesso!');
      loadRodizios();
    } catch (error) {
      showAlert('Erro ao limpar', 'error');
    } finally {
      setLoadingGerar(false);
    }
  };

  const handleLimparERefazer = async () => {
    if (!gerarForm.igreja_id) { showAlert('Selecione uma igreja', 'error'); return; }


    let dataMsg = gerarForm.data_inicial ? `a partir de ${gerarForm.data_inicial}` : 'COMPLETO';
    if (!window.confirm(`Isso apagará a escala ${dataMsg} e gerará uma nova. Continuar?`)) return;

    try {
      setLoadingGerar(true);
      let dataInicial = gerarForm.data_inicial;
      if (dataInicial && dataInicial.includes('/')) dataInicial = parseDataBrasileira(dataInicial);

      // Usar endpoint inteligente que limpa do futuro e regera
      const response = await refazerRodizio({
        igreja_id: parseInt(gerarForm.igreja_id),
        periodo_meses: gerarForm.periodo_meses,
        ciclo_inicial: parseInt(gerarForm.ciclo_inicial || 1),
        data_inicial: dataInicial || null,
        organista_inicial: gerarForm.organista_inicial ? parseInt(gerarForm.organista_inicial) : null
      });

      showAlert(`Refeito com sucesso! ${response.data.rodizios} registros.`);
      loadRodizios();
    } catch (error) {
      console.error(error);
      showAlert('Erro ao refazer: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setLoadingGerar(false);
    }
  };

  const handleGerarPDF = async () => {
    if (!filtros.igreja_id) { showAlert('Selecione uma igreja', 'error'); return; }
    try {
      const response = await getRodizioPDF(filtros.igreja_id, filtros.periodo_inicio, filtros.periodo_fim);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rodizio_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showAlert('PDF gerado!');
    } catch (error) {
      showAlert('Erro ao gerar PDF', 'error');
    }
  };

  const handleExportarCSV = () => {
    if (!rodizios || rodizios.length === 0) {
      showAlert('Nenhum rodizio para exportar.', 'error');
      return;
    }

    const escapeCSV = (valor) => {
      if (valor === null || valor === undefined) return '';
      const texto = String(valor).replace(/"/g, '""');
      return `"${texto}"`;
    };

    const linhas = [];
    linhas.push([
      'data',
      'dia_semana',
      'hora',
      'ciclo',
      'funcao',
      'organista',
      'telefone',
      'igreja'
    ].join(';'));

    for (const r of rodizios) {
      const funcaoTexto = r.funcao === 'meia_hora'
        ? 'Meia Hora'
        : (r.culto_tipo === 'rjm' ? 'RJM' : 'Culto');

      linhas.push([
        escapeCSV(formatarData(r.data_culto)),
        escapeCSV(r.dia_semana || ''),
        escapeCSV(r.hora_culto ? String(r.hora_culto).slice(0, 5) : ''),
        escapeCSV(r.ciclo_nome || r.ciclo_origem || ''),
        escapeCSV(funcaoTexto),
        escapeCSV(r.organista_nome || ''),
        escapeCSV(r.organista_telefone || ''),
        escapeCSV(r.igreja_nome || '')
      ].join(';'));
    }

    const conteudo = `\uFEFF${linhas.join('\n')}`;
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const igrejaNome = filtros.igreja_id
      ? (igrejas.find((i) => String(i.id) === String(filtros.igreja_id))?.nome || 'igreja')
      : 'todas_igrejas';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.setAttribute('download', `backup_rodizio_${igrejaNome.replace(/\s+/g, '_')}_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 100);
    showAlert('Backup CSV exportado com sucesso!');
  };

  const handleTestarWebhook = async () => {
    try { setLoadingWebhook(true); await testarWebhook(); showAlert('Webhook OK!'); }
    catch { showAlert('Erro Webhook', 'error'); } finally { setLoadingWebhook(false); }
  };

  const handleImportarRodizio = async () => {
    if (!gerarForm.igreja_id || !arquivoCSV) {
      showAlert('Selecione uma igreja e escolha um arquivo CSV', 'error');
      return;
    }

    try {
      setLoadingImportar(true);

      const lerArquivo = () => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Erro ao ler arquivo'));
        reader.readAsText(arquivoCSV);
      });

      const csvContent = await lerArquivo();
      console.log('[CLIENT] Iniciando importação...', { tamanho: csvContent.length });

      const response = await importarRodizio(parseInt(gerarForm.igreja_id), csvContent);
      const payload = response?.data || {};
      const isSuccess = payload.sucesso !== false;

      if (isSuccess) {
        const inseridos = Number(payload.rodiziosInseridos || 0);
        const duplicados = Array.isArray(payload.duplicados) ? payload.duplicados.length : 0;

        let msg = payload.message || `Importação concluída! ${inseridos} registros inseridos.`;
        let alertType = 'success';

        if (inseridos === 0 && duplicados > 0) {
          msg = `Importação concluída sem novos registros: ${duplicados} linha(s) já existiam (duplicadas).`;
          alertType = 'warning';
        }

        showAlert(msg, alertType);
        loadRodizios();
        setArquivoCSV(null); // Limpar arquivo após sucesso
      } else {
        // Tratar erros de validação retornados pelo backend (sucesso: false)
        const erros = payload.erros || payload.details || [];
        const msgErro = erros.length > 0
          ? `Falha na importação:\n- ${erros.slice(0, 10).join('\n- ')}${erros.length > 10 ? '\n...' : ''}`
          : (payload.error || 'Erro desconhecido na importação');
        showAlert(msgErro, 'error');
      }
    } catch (error) {
      console.error('[CLIENT] Erro detalhado ao importar:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      const resData = error.response?.data;
      const backendError = resData?.error;
      const backendDetails = resData?.detalhes || resData?.erros || resData?.details;

      let msg = backendError || 'Erro de conexão ou formato de arquivo inválido';

      if (Array.isArray(backendDetails) && backendDetails.length > 0) {
        msg = `${msg}:\n- ${backendDetails.slice(0, 10).join('\n- ')}${backendDetails.length > 10 ? '\n...' : ''}`;
      } else if (backendDetails && typeof backendDetails === 'object') {
        msg = `${msg}: ${JSON.stringify(backendDetails)}`;
      }

      showAlert(msg, 'error');
    } finally {
      setLoadingImportar(false);
    }
  };

  const formatarData = (d) => formatarDataBrasileira(d);

  if (loading) return <div className="loading">Carregando...</div>;

  return (
    <div>
      <div className="card">
        <h2>Gerar Rodízio</h2>
        <p className="lead">
          Fluxo recomendado: gerar rodizio, revisar/editar na tabela abaixo e gerar o PDF no proprio menu de Rodizios.
        </p>
        {alert && <div className={`alert alert-${alert.type}`} style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>{alert.message}</div>}

        <form onSubmit={handleGerarRodizio} className="form--spaced">
          <div className="form-group">
            <label>Igreja *</label>
            <select className="rodizios__select-igreja" value={gerarForm.igreja_id} onChange={e => setGerarForm({ ...gerarForm, igreja_id: e.target.value })} required disabled={currentUser?.role !== 'admin'}>
              <option value="">Selecione...</option>
              {igrejas.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Período *</label>
            <select value={gerarForm.periodo_meses} onChange={e => setGerarForm({ ...gerarForm, periodo_meses: parseInt(e.target.value) })}>
              <option value={3}>3 meses</option>
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
            </select>
          </div>

          <div className="form-group">
            <label>Data Inicial</label>
            <input type="text" placeholder="dd/mm/yyyy" value={gerarForm.data_inicial} onChange={e => setGerarForm({ ...gerarForm, data_inicial: aplicarMascaraData(e.target.value) })} maxLength={10} />
            <small className="form-hint">Deixe em branco para começar hoje.</small>
          </div>

          {gerarForm.igreja_id && organistasIgreja.length > 0 && (
            <div className="form-group">
              <label>Organista Inicial</label>
              <select value={gerarForm.organista_inicial} onChange={e => setGerarForm({ ...gerarForm, organista_inicial: e.target.value })}>
                <option value="">Começar pela primeira da fila</option>
                {organistasIgreja.map((organista) => (
                  <option key={organista.id} value={organista.id}>
                    {organista.nome}
                  </option>
                ))}
              </select>
              <small className="form-hint">Escolha para forçar o início.</small>
            </div>
          )}

          {gerarForm.igreja_id && ciclosIgreja.length > 0 && (
            <div className="form-group">
              <label>Ciclo Inicial *</label>
              <select value={gerarForm.ciclo_inicial} onChange={e => setGerarForm({ ...gerarForm, ciclo_inicial: e.target.value })} required>
                <option value="">Selecione...</option>
                {ciclosIgreja.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome || `Ciclo ${c.ordem || c.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loadingGerar}>{loadingGerar ? 'Gerando...' : 'Gerar Rodízio'}</button>
            {gerarForm.igreja_id && (
              <>
                <button type="button" className="btn btn-secondary" onClick={handleLimparERefazer} disabled={loadingGerar}>Refazer</button>
                <button type="button" className="btn btn-danger" onClick={handleLimparRodizios} disabled={loadingGerar}>Limpar</button>
              </>
            )}
            <button type="button" className="btn btn-primary" onClick={handleTestarWebhook} disabled={loadingWebhook}>Testar Webhook</button>
          </div>
        </form>

        <div className="form-section" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
          <h3>Importar CSV</h3>
          <input type="file" accept=".csv" onChange={e => setArquivoCSV(e.target.files[0])} />
          <button type="button" className="btn btn-primary" onClick={handleImportarRodizio} disabled={loadingImportar || !arquivoCSV} style={{ marginTop: '10px' }}>Importar</button>
        </div>
      </div>

      <div className="card">
        <h2>Rodízios Gerados</h2>
        <div className="btn-row btn-row--no-margin">
          <select value={filtros.igreja_id} onChange={e => setFiltros({ ...filtros, igreja_id: e.target.value })}>
            <option value="">Todas as igrejas</option>
            {igrejas.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
          <button className="btn btn-success" onClick={handleGerarPDF} disabled={!filtros.igreja_id}>Gerar PDF</button>
          <button className="btn btn-secondary" onClick={handleExportarCSV} disabled={rodizios.length === 0}>Baixar CSV (Backup)</button>
        </div>

        {rodizios.length === 0 ? <div className="empty">Nenhum rodízio</div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Data</th><th>Dia</th><th>Hora</th><th>Ciclo</th><th>Função</th><th>Organista</th><th>Tel</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {rodizios.map(r => (
                  <tr key={r.id}>
                    <td className="td-strong table__nowrap">{formatarData(r.data_culto)}</td>
                    <td className="text-capitalize">{r.dia_semana}</td>
                    <td>{r.hora_culto ? r.hora_culto.slice(0, 5) : '-'}</td>
                    <td>{r.ciclo_nome || r.ciclo_origem || '-'}</td>
                    <td>
                      <span className={`badge ${r.funcao === 'meia_hora' ? 'badge--warn' : (r.culto_tipo === 'rjm' ? 'badge--success' : 'badge--info')}`}>
                        {r.funcao === 'meia_hora' ? 'Meia Hora' : (r.culto_tipo === 'rjm' ? 'RJM' : 'Culto')}
                      </span>
                    </td>
                    <td className="table__cell--break">
                      {editandoRodizio === r.id ? (
                        <select value={organistaEditando} onChange={e => setOrganistaEditando(e.target.value)}>
                          <option value="">Selecione...</option>
                          {organistasIgreja.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                        </select>
                      ) : r.organista_nome}
                    </td>
                    <td>{r.organista_telefone || '-'}</td>
                    <td>
                      {editandoRodizio === r.id ? (
                        <div className="btn-row btn-row--no-margin actions-inline">
                          <button className="btn btn-success" onClick={() => handleSalvarEdicao(r.id)}>✓</button>
                          <button className="btn btn-secondary" onClick={handleCancelarEdicao}>✕</button>
                        </div>
                      ) : (
                        <button className="btn btn-primary" onClick={(e) => {
                          e.preventDefault();
                          if (organistasIgreja.length === 0) loadOrganistasIgreja(r.igreja_id);
                          handleIniciarEdicao(r);
                        }}>✏️ Editar</button>
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
