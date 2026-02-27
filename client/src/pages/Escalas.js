import React, { useState, useEffect, useCallback } from 'react';
import {
  getIgrejas,
  gerarPreviaEscala,
  listEscalas,
  getEscala,
  salvarEscala,
  deleteEscala,
  getEscalaPDF,
  getEscalaPDFPrevia
} from '../services/api';

function Escalas({ user }) {
  const [igrejas, setIgrejas] = useState([]);
  const [igrejaId, setIgrejaId] = useState('');
  const [escalasSalvas, setEscalasSalvas] = useState([]);
  const [escalaSelecionada, setEscalaSelecionada] = useState(null);
  const [detalheEscala, setDetalheEscala] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPrevia, setLoadingPrevia] = useState(false);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [alert, setAlert] = useState(null);

  const [modoNova, setModoNova] = useState(false);
  const [form, setForm] = useState({
    nome_referencia: '',
    data_inicio: '',
    data_fim: ''
  });
  const [previaItens, setPreviaItens] = useState([]);

  const loadIgrejas = useCallback(async () => {
    try {
      const res = await getIgrejas();
      setIgrejas(res.data || []);
    } catch (e) {
      setAlert({ message: 'Erro ao carregar igrejas', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIgrejas();
  }, [loadIgrejas]);

  useEffect(() => {
    if (user?.role !== 'admin' && igrejas.length === 1) {
      setIgrejaId(igrejas[0].id.toString());
    }
  }, [igrejas, user]);

  useEffect(() => {
    if (!igrejaId) {
      setEscalasSalvas([]);
      setEscalaSelecionada(null);
      setDetalheEscala(null);
      return;
    }
    (async () => {
      try {
        const res = await listEscalas(igrejaId);
        setEscalasSalvas(res.data || []);
        setEscalaSelecionada(null);
        setDetalheEscala(null);
      } catch (e) {
        setAlert({ message: e.response?.data?.error || 'Erro ao carregar escalas', type: 'error' });
      }
    })();
  }, [igrejaId]);

  useEffect(() => {
    if (!escalaSelecionada) {
      setDetalheEscala(null);
      return;
    }
    (async () => {
      try {
        const res = await getEscala(escalaSelecionada);
        setDetalheEscala(res.data);
      } catch (e) {
        setAlert({ message: e.response?.data?.error || 'Erro ao carregar escala', type: 'error' });
      }
    })();
  }, [escalaSelecionada]);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleGerarPrevia = async () => {
    if (!igrejaId || !form.data_inicio || !form.data_fim) {
      showAlert('Preencha igreja, data início e data fim.', 'error');
      return;
    }
    setLoadingPrevia(true);
    try {
      const res = await gerarPreviaEscala(igrejaId, form.data_inicio, form.data_fim);
      setPreviaItens(res.data.itens || []);
      showAlert('Prévia gerada. Revise e salve se estiver correta.');
    } catch (e) {
      showAlert(e.response?.data?.error || 'Erro ao gerar prévia', 'error');
      setPreviaItens([]);
    } finally {
      setLoadingPrevia(false);
    }
  };

  const handleSalvarEscala = async () => {
    if (!form.nome_referencia || !form.data_inicio || !form.data_fim) {
      showAlert('Preencha nome de referência e datas.', 'error');
      return;
    }
    if (previaItens.length === 0) {
      showAlert('Gere a prévia antes de salvar.', 'error');
      return;
    }
    setLoadingSalvar(true);
    try {
      await salvarEscala({
        igreja_id: parseInt(igrejaId),
        nome_referencia: form.nome_referencia,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        status: 'Publicada',
        itens: previaItens.map(i => ({
          data: i.data,
          hora: i.hora,
          culto_nome: i.culto_nome,
          funcao: i.funcao,
          organista_id: i.organista_id,
          organista_nome: i.organista_nome,
          ciclo_origem: i.ciclo_origem
        }))
      });
      showAlert('Escala salva com sucesso.');
      setPreviaItens([]);
      setModoNova(false);
      setForm({ nome_referencia: '', data_inicio: '', data_fim: '' });
      const res = await listEscalas(igrejaId);
      setEscalasSalvas(res.data || []);
    } catch (e) {
      showAlert(e.response?.data?.error || 'Erro ao salvar escala', 'error');
    } finally {
      setLoadingSalvar(false);
    }
  };

  const handleDownloadPdfPrevia = async () => {
    if (previaItens.length === 0) {
      showAlert('Gere a prévia antes de baixar o PDF.', 'error');
      return;
    }
    setLoadingPdf(true);
    try {
      // Garantir que cada item envie ciclo_origem (e demais campos) sem perda no payload
      const itensParaPdf = previaItens.map((item) => ({
        data: item.data,
        hora: item.hora,
        culto_nome: item.culto_nome,
        funcao: item.funcao,
        organista_id: item.organista_id,
        organista_nome: item.organista_nome ?? '',
        ciclo_origem: item.ciclo_origem
      }));
      const res = await getEscalaPDFPrevia({
        igreja_id: parseInt(igrejaId),
        nome_referencia: form.nome_referencia || 'Prévia de Escala',
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        itens: itensParaPdf
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'escala-previa.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
      showAlert('PDF baixado.');
    } catch (e) {
      showAlert(e.response?.data?.error || 'Erro ao gerar PDF', 'error');
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleDownloadPdfEscala = async (id) => {
    setLoadingPdf(true);
    try {
      const res = await getEscalaPDF(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `escala-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      showAlert('PDF baixado.');
    } catch (e) {
      showAlert(e.response?.data?.error || 'Erro ao gerar PDF', 'error');
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleExcluirEscala = async (id) => {
    if (!window.confirm('Excluir esta escala do histórico?')) return;
    try {
      await deleteEscala(id);
      showAlert('Escala excluída.');
      setEscalaSelecionada(null);
      setDetalheEscala(null);
      const res = await listEscalas(igrejaId);
      setEscalasSalvas(res.data || []);
    } catch (e) {
      showAlert(e.response?.data?.error || 'Erro ao excluir', 'error');
    }
  };

  const formatarDataBr = (s) => {
    if (!s) return '-';
    const [y, m, d] = s.split(/[-T]/);
    return d && m && y ? `${d}/${m}/${y}` : s;
  };
  const formatarHora = (h) => (h ? String(h).slice(0, 5) : '-');

  if (loading) return <div className="loading">Carregando...</div>;

  return (
    <div className="card">
      <div className="page-header">
        <h2>Gestão de Escalas</h2>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      <div className="form-group">
        <label>Igreja</label>
        <select
          value={igrejaId}
          onChange={(e) => setIgrejaId(e.target.value)}
          disabled={user?.role !== 'admin' && igrejas.length === 1}
        >
          <option value="">Selecione a igreja</option>
          {igrejas.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
            </option>
          ))}
        </select>
      </div>

      {!igrejaId && (
        <p className="form-hint">Selecione uma igreja para ver o histórico e criar novas escalas.</p>
      )}

      {igrejaId && (
        <>
          {/* Histórico de escalas salvas */}
          <section style={{ marginTop: '1.5rem' }}>
            <h3>Histórico de Escalas</h3>
            {escalasSalvas.length === 0 ? (
              <p className="form-hint">Nenhuma escala salva ainda.</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Data Início</th>
                      <th>Data Fim</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escalasSalvas.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => setEscalaSelecionada(e.id)}
                          >
                            {e.nome_referencia}
                          </button>
                        </td>
                        <td>{formatarDataBr(e.data_inicio)}</td>
                        <td>{formatarDataBr(e.data_fim)}</td>
                        <td>{e.status}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleDownloadPdfEscala(e.id)}
                            disabled={loadingPdf}
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ marginLeft: 8 }}
                            onClick={() => handleExcluirEscala(e.id)}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Visualização da escala selecionada (somente leitura) */}
          {detalheEscala && escalaSelecionada && (
            <section style={{ marginTop: '1.5rem' }}>
              <h3>{detalheEscala.nome_referencia}</h3>
              <p>
                {formatarDataBr(detalheEscala.data_inicio)} a {formatarDataBr(detalheEscala.data_fim)}
              </p>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Hora</th>
                      <th>Culto</th>
                      <th>Função</th>
                      <th>Organista (Ciclo)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detalheEscala.itens || []).map((item, idx) => (
                      <tr key={idx}>
                        <td>{formatarDataBr(item.data)}</td>
                        <td>{formatarHora(item.hora)}</td>
                        <td>{item.culto_nome}</td>
                        <td>{item.funcao === 'meia_hora' ? 'Meia Hora' : 'Tocar no Culto'}</td>
                        <td>
                          {item.organista_nome}
                          {item.ciclo_origem ? ` (Ciclo ${item.ciclo_origem})` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Nova escala */}
          <section style={{ marginTop: '2rem' }}>
            <h3>Nova Escala</h3>
            {!modoNova ? (
              <button type="button" className="btn btn-primary" onClick={() => setModoNova(true)}>
                Criar nova escala
              </button>
            ) : (
              <>
                <div className="form--spaced" style={{ maxWidth: 500 }}>
                  <div className="form-group">
                    <label>Nome de referência</label>
                    <input
                      type="text"
                      value={form.nome_referencia}
                      onChange={(e) => setForm((f) => ({ ...f, nome_referencia: e.target.value }))}
                      placeholder="Ex: 2º Trimestre 2026"
                    />
                  </div>
                  <div className="form-group">
                    <label>Data início</label>
                    <input
                      type="date"
                      value={form.data_inicio}
                      onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Data fim</label>
                    <input
                      type="date"
                      value={form.data_fim}
                      onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleGerarPrevia}
                      disabled={loadingPrevia}
                    >
                      {loadingPrevia ? 'Gerando...' : 'Gerar Prévia'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setModoNova(false);
                        setPreviaItens([]);
                        setForm({ nome_referencia: '', data_inicio: '', data_fim: '' });
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>

                {previaItens.length > 0 && (
                  <>
                    <h4 style={{ marginTop: '1.5rem' }}>Prévia da escala</h4>
                    <div className="table-wrapper">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Hora</th>
                            <th>Culto</th>
                            <th>Função</th>
                            <th>Organista (Ciclo)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previaItens.map((item, idx) => (
                            <tr key={idx}>
                              <td>{formatarDataBr(item.data)}</td>
                              <td>{formatarHora(item.hora)}</td>
                              <td>{item.culto_nome}</td>
                              <td>{item.funcao === 'meia_hora' ? 'Meia Hora' : 'Tocar no Culto'}</td>
                              <td>
                                {item.organista_nome}
                                {item.ciclo_origem ? ` (Ciclo ${item.ciclo_origem})` : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSalvarEscala}
                        disabled={loadingSalvar}
                      >
                        {loadingSalvar ? 'Salvando...' : 'Salvar Escala'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleDownloadPdfPrevia}
                        disabled={loadingPdf}
                      >
                        Gerar PDF
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default Escalas;
