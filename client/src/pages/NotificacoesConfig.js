import React, { useEffect, useMemo, useState } from 'react';
import {
  getIgrejas,
  getNotificacaoConfiguracao,
  salvarNotificacaoConfiguracao,
  testarNotificacaoConfiguracao
} from '../services/api';
import './NotificacoesConfig.css';

const CARGOS_FALLBACK = [
  { key: 'encarregado_local', label: 'Encarregado Local' },
  { key: 'encarregado_regional', label: 'Encarregado Regional' },
  { key: 'anciao', label: 'Anciao' },
  { key: 'cooperador_oficio', label: 'Cooperador do Oficio' },
  { key: 'cooperador_jovens', label: 'Cooperador de Jovens' },
  { key: 'examinadoras', label: 'Examinadoras' },
  { key: 'diacono', label: 'Diacono' }
];

const novoDestinatario = () => ({
  cargo: 'encarregado_local',
  nome: '',
  telefone: '',
  ativo: true
});

function NotificacoesConfig({ user }) {
  const [igrejas, setIgrejas] = useState([]);
  const [igrejaId, setIgrejaId] = useState('');
  const [cargosDisponiveis, setCargosDisponiveis] = useState(CARGOS_FALLBACK);
  const [destinatariosPadrao, setDestinatariosPadrao] = useState([]);
  const [horarioDia, setHorarioDia] = useState('10:00');
  const [horarioRjm, setHorarioRjm] = useState('18:00');
  const [destinatarios, setDestinatarios] = useState([]);
  const [telefoneTeste, setTelefoneTeste] = useState('');
  const [mensagemTeste, setMensagemTeste] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingDestinatarioIndex, setTestingDestinatarioIndex] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const canManage = useMemo(() => (
    user?.role === 'admin' || user?.tipo_usuario === 'encarregado'
  ), [user]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        const response = await getIgrejas();
        const lista = response.data || [];
        setIgrejas(lista);
        if (lista.length > 0) {
          setIgrejaId(String(lista[0].id));
        }
      } catch (error) {
        setFeedback({ type: 'error', text: error.response?.data?.error || 'Erro ao carregar igrejas.' });
      } finally {
        setLoading(false);
      }
    };

    if (canManage) {
      bootstrap();
    } else {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (!igrejaId || !canManage) return;

    const carregarConfiguracao = async () => {
      try {
        setLoadingConfig(true);
        setFeedback(null);

        const response = await getNotificacaoConfiguracao(parseInt(igrejaId, 10));
        const data = response.data || {};
        const config = data.configuracao || {};

        setCargosDisponiveis(data.cargos_disponiveis || CARGOS_FALLBACK);
        setHorarioDia(config.horario_dia || '10:00');
        setHorarioRjm(config.horario_rjm || '18:00');

        const listaPadrao = config.destinatarios_padrao || [];
        const listaAtiva = config.destinatarios || [];
        setDestinatariosPadrao(listaPadrao);
        setDestinatarios(listaAtiva.length > 0 ? listaAtiva : (listaPadrao.length > 0 ? listaPadrao : [novoDestinatario()]));
      } catch (error) {
        setFeedback({ type: 'error', text: error.response?.data?.error || 'Erro ao carregar configuracoes de envio.' });
      } finally {
        setLoadingConfig(false);
      }
    };

    carregarConfiguracao();
  }, [igrejaId, canManage]);

  const handleDestinatarioChange = (index, field, value) => {
    setDestinatarios((prev) => prev.map((item, idx) => (
      idx === index ? { ...item, [field]: value } : item
    )));
  };

  const handleAdicionarDestinatario = () => {
    const cargoInicial = cargosDisponiveis?.[0]?.key || 'encarregado_local';
    setDestinatarios((prev) => [...prev, { ...novoDestinatario(), cargo: cargoInicial }]);
  };

  const handleRemoverDestinatario = (index) => {
    setDestinatarios((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRestaurarPadrao = () => {
    if (destinatariosPadrao.length > 0) {
      setDestinatarios(destinatariosPadrao);
      setFeedback({ type: 'success', text: 'Modelo padrao restaurado (encarregado local/regional da igreja).' });
      return;
    }

    setDestinatarios([novoDestinatario()]);
    setFeedback({ type: 'error', text: 'A igreja nao possui padrao cadastrado. Preencha os destinatarios manualmente.' });
  };

  const handleSalvar = async (event) => {
    event.preventDefault();
    if (!igrejaId) return;

    try {
      setSaving(true);
      setFeedback(null);

      await salvarNotificacaoConfiguracao({
        igreja_id: parseInt(igrejaId, 10),
        horario_dia: horarioDia,
        horario_rjm: horarioRjm,
        destinatarios
      });

      setFeedback({ type: 'success', text: 'Configuracoes de envio salvas com sucesso.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.response?.data?.error || 'Erro ao salvar configuracoes de envio.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTeste = async () => {
    if (!igrejaId) return;

    try {
      setTesting(true);
      setFeedback(null);

      await testarNotificacaoConfiguracao({
        igreja_id: parseInt(igrejaId, 10),
        telefone: telefoneTeste,
        mensagem: mensagemTeste
      });

      setFeedback({ type: 'success', text: 'Mensagem de teste enviada com sucesso.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.response?.data?.error || 'Erro ao enviar mensagem de teste.' });
    } finally {
      setTesting(false);
    }
  };

  const handleTesteDestinatario = async (index) => {
    if (!igrejaId) return;
    const destinatario = destinatarios[index];
    const telefone = String(destinatario?.telefone || '').trim();
    if (!telefone) {
      setFeedback({ type: 'error', text: 'Informe o telefone do destinatario para testar.' });
      return;
    }

    try {
      setTestingDestinatarioIndex(index);
      setFeedback(null);

      await testarNotificacaoConfiguracao({
        igreja_id: parseInt(igrejaId, 10),
        telefone,
        cargo: destinatario?.cargo || 'teste',
        nome: destinatario?.nome || ''
      });

      const nomeExibicao = destinatario?.nome || destinatario?.cargo || 'destinatario';
      setFeedback({ type: 'success', text: `Teste enviado para ${nomeExibicao}.` });
    } catch (error) {
      setFeedback({ type: 'error', text: error.response?.data?.error || 'Erro ao enviar teste para destinatario.' });
    } finally {
      setTestingDestinatarioIndex(null);
    }
  };

  if (!canManage) {
    return (
      <div className="notificacao-config-page">
        <h2>Configuracao de Envio</h2>
        <p>Somente admin ou encarregado podem acessar esta configuracao.</p>
      </div>
    );
  }

  return (
    <div className="notificacao-config-page">
      <div className="notificacao-config-header">
        <h2>Configuracao de Envio Consolidado</h2>
        <p>
          Defina quem recebe a mensagem de rodizio dos encarregados e em qual horario enviar.
          Isso nao altera as mensagens individuais das organistas.
        </p>
      </div>

      {feedback && (
        <div className={`notificacao-feedback notificacao-feedback--${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <form className="notificacao-card" onSubmit={handleSalvar}>
        <div className="notificacao-field">
          <label htmlFor="igreja-notificacao">Igreja</label>
          <select
            id="igreja-notificacao"
            value={igrejaId}
            onChange={(e) => setIgrejaId(e.target.value)}
            disabled={loading || loadingConfig || saving}
          >
            {igrejas.map((igreja) => (
              <option key={igreja.id} value={igreja.id}>{igreja.nome}</option>
            ))}
          </select>
        </div>

        <div className="notificacao-grid-2">
          <div className="notificacao-field">
            <label htmlFor="horario-dia">Horario consolidado do dia</label>
            <input
              id="horario-dia"
              type="time"
              value={horarioDia}
              onChange={(e) => setHorarioDia(e.target.value)}
              disabled={loading || loadingConfig || saving}
            />
            <small>Padrao: 10:00</small>
          </div>

          <div className="notificacao-field">
            <label htmlFor="horario-rjm">Horario RJM (domingo 10:00)</label>
            <input
              id="horario-rjm"
              type="time"
              value={horarioRjm}
              onChange={(e) => setHorarioRjm(e.target.value)}
              disabled={loading || loadingConfig || saving}
            />
            <small>Padrao: sabado 18:00</small>
          </div>
        </div>

        <div className="notificacao-section-header">
          <h3>Destinatarios do consolidado</h3>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAdicionarDestinatario}
            disabled={loading || loadingConfig || saving}
          >
            + Adicionar destinatario
          </button>
        </div>

        <div className="notificacao-destinatarios">
          {destinatarios.map((destinatario, index) => (
            <div className="notificacao-destinatario-row" key={`${destinatario.cargo}-${index}`}>
              <div className="notificacao-destinatario-fields">
                <div className="notificacao-inline-field">
                  <label htmlFor={`cargo-${index}`}>Cargo</label>
                  <select
                    id={`cargo-${index}`}
                    value={destinatario.cargo || ''}
                    onChange={(e) => handleDestinatarioChange(index, 'cargo', e.target.value)}
                    disabled={loading || loadingConfig || saving}
                  >
                    {cargosDisponiveis.map((cargo) => (
                      <option key={cargo.key} value={cargo.key}>{cargo.label}</option>
                    ))}
                  </select>
                </div>

                <div className="notificacao-inline-field">
                  <label htmlFor={`nome-${index}`}>Nome</label>
                  <input
                    id={`nome-${index}`}
                    type="text"
                    placeholder="Nome do destinatario"
                    value={destinatario.nome || ''}
                    onChange={(e) => handleDestinatarioChange(index, 'nome', e.target.value)}
                    disabled={loading || loadingConfig || saving}
                  />
                </div>

                <div className="notificacao-inline-field">
                  <label htmlFor={`telefone-${index}`}>Telefone</label>
                  <input
                    id={`telefone-${index}`}
                    type="text"
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    value={destinatario.telefone || ''}
                    onChange={(e) => handleDestinatarioChange(index, 'telefone', e.target.value)}
                    disabled={loading || loadingConfig || saving}
                  />
                </div>
              </div>

              <div className="notificacao-destinatario-actions">
                <label className="notificacao-switch" htmlFor={`ativo-${index}`}>
                  <input
                    id={`ativo-${index}`}
                    type="checkbox"
                    checked={destinatario.ativo !== false}
                    onChange={(e) => handleDestinatarioChange(index, 'ativo', e.target.checked)}
                    disabled={loading || loadingConfig || saving}
                  />
                  <span className="notificacao-switch-slider" />
                  <span className="notificacao-switch-text">Ativo</span>
                </label>

                <div className="notificacao-row-buttons">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleTesteDestinatario(index)}
                    disabled={loading || loadingConfig || saving || !String(destinatario.telefone || '').trim() || testingDestinatarioIndex !== null}
                  >
                    {testingDestinatarioIndex === index ? 'Testando...' : 'Testar'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleRemoverDestinatario(index)}
                    disabled={loading || loadingConfig || saving || destinatarios.length <= 1}
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="notificacao-actions">
          <button type="submit" className="btn btn-primary" disabled={loading || loadingConfig || saving || !igrejaId}>
            {saving ? 'Salvando...' : 'Salvar configuracoes'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleRestaurarPadrao} disabled={loading || loadingConfig || saving}>
            Restaurar padrao
          </button>
        </div>
      </form>

      <div className="notificacao-card">
        <h3>Teste de envio</h3>
        <p>Informe um telefone para validar rapidamente o webhook e o conteudo.</p>

        <div className="notificacao-grid-2">
          <div className="notificacao-field">
            <label htmlFor="telefone-teste">Telefone de teste</label>
            <input
              id="telefone-teste"
              type="text"
              placeholder="(00) 00000-0000"
              value={telefoneTeste}
              onChange={(e) => setTelefoneTeste(e.target.value)}
              disabled={testing || loading || loadingConfig}
            />
          </div>

          <div className="notificacao-field">
            <label htmlFor="mensagem-teste">Mensagem de teste (opcional)</label>
            <textarea
              id="mensagem-teste"
              rows={4}
              placeholder="Deixe em branco para usar a mensagem padrao de teste"
              value={mensagemTeste}
              onChange={(e) => setMensagemTeste(e.target.value)}
              disabled={testing || loading || loadingConfig}
            />
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleTeste}
          disabled={testing || !telefoneTeste.trim() || !igrejaId}
        >
          {testing ? 'Enviando teste...' : 'Enviar teste'}
        </button>
      </div>
    </div>
  );
}

export default NotificacoesConfig;
