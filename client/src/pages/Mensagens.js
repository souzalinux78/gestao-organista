import React, { useEffect, useMemo, useState } from 'react';
import { getIgrejas, getMensagemTemplates, salvarMensagemTemplates } from '../services/api';
import './Mensagens.css';

const DEFAULT_ORGANISTA_TEMPLATE = [
  'Ola, {{organista_nome}}! A paz de Deus.',
  '',
  'Data: {{data}}',
  'Igreja: {{igreja_nome}}',
  'Funcao: {{funcao}}',
  'Horario: {{hora}}',
  '',
  'Que Deus abencoe sua participacao.'
].join('\n');

const DEFAULT_ENCARREGADO_TEMPLATE = [
  'Notificacao de escala para {{referencia}}',
  '',
  'Data: {{data}}',
  'Igreja: {{igreja_nome}}',
  '',
  '{{lista_rodizios}}'
].join('\n');

function Mensagens({ user }) {
  const [igrejas, setIgrejas] = useState([]);
  const [igrejaId, setIgrejaId] = useState('');
  const [organistaTemplate, setOrganistaTemplate] = useState('');
  const [encarregadoTemplate, setEncarregadoTemplate] = useState('');
  const [placeholders, setPlaceholders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

    const loadTemplates = async () => {
      try {
        setLoading(true);
        const response = await getMensagemTemplates(parseInt(igrejaId, 10));
        const data = response.data || {};
        setOrganistaTemplate(data.templates?.organista || DEFAULT_ORGANISTA_TEMPLATE);
        setEncarregadoTemplate(data.templates?.encarregado || DEFAULT_ENCARREGADO_TEMPLATE);
        setPlaceholders(data.placeholders || []);
      } catch (error) {
        setFeedback({ type: 'error', text: error.response?.data?.error || 'Erro ao carregar templates.' });
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [igrejaId, canManage]);

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!igrejaId) return;

    try {
      setSaving(true);
      setFeedback(null);
      await salvarMensagemTemplates(
        parseInt(igrejaId, 10),
        organistaTemplate,
        encarregadoTemplate
      );
      setFeedback({ type: 'success', text: 'Templates salvos com sucesso.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.response?.data?.error || 'Erro ao salvar templates.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestaurarPadrao = () => {
    setOrganistaTemplate(DEFAULT_ORGANISTA_TEMPLATE);
    setEncarregadoTemplate(DEFAULT_ENCARREGADO_TEMPLATE);
  };

  const handleUsarFallbackAutomatico = () => {
    setOrganistaTemplate('');
    setEncarregadoTemplate('');
  };

  if (!canManage) {
    return (
      <div className="mensagens-page">
        <h2>Mensagens</h2>
        <p>Somente admin ou encarregado podem configurar templates de mensagem.</p>
      </div>
    );
  }

  return (
    <div className="mensagens-page">
      <div className="mensagens-header">
        <h2>Mensagens de Notificacao</h2>
        <p>Personalize o texto enviado para organistas e encarregados por igreja.</p>
      </div>

      {feedback && (
        <div className={`mensagens-feedback mensagens-feedback--${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <form className="mensagens-card" onSubmit={handleSalvar}>
        <div className="mensagens-field">
          <label htmlFor="igreja">Igreja</label>
          <select
            id="igreja"
            value={igrejaId}
            onChange={(e) => setIgrejaId(e.target.value)}
            disabled={loading || saving}
          >
            {igrejas.map((igreja) => (
              <option key={igreja.id} value={igreja.id}>{igreja.nome}</option>
            ))}
          </select>
        </div>

        <div className="mensagens-field">
          <label htmlFor="template-organista">Template da Organista</label>
          <textarea
            id="template-organista"
            rows={8}
            value={organistaTemplate}
            onChange={(e) => setOrganistaTemplate(e.target.value)}
            placeholder="Deixe em branco para usar a mensagem padrao."
            disabled={loading || saving}
          />
        </div>

        <div className="mensagens-field">
          <label htmlFor="template-encarregado">Template do Encarregado (consolidado)</label>
          <textarea
            id="template-encarregado"
            rows={10}
            value={encarregadoTemplate}
            onChange={(e) => setEncarregadoTemplate(e.target.value)}
            placeholder="Deixe em branco para usar a mensagem padrao."
            disabled={loading || saving}
          />
        </div>

        <div className="mensagens-actions">
          <button type="submit" className="btn btn-primary" disabled={loading || saving || !igrejaId}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleRestaurarPadrao} disabled={loading || saving}>
            Inserir modelo padrao
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleUsarFallbackAutomatico} disabled={loading || saving}>
            Usar fallback automatico
          </button>
        </div>
      </form>

      <div className="mensagens-card">
        <h3>Placeholders disponiveis</h3>
        <p>Use no formato {'{{chave}}'} dentro do template.</p>
        <div className="mensagens-placeholders">
          {placeholders.map((item) => (
            <div key={item.key} className="mensagens-placeholder-item">
              <code>{`{{${item.key}}}`}</code>
              <span>{item.descricao}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Mensagens;
