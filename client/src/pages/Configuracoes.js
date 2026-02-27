import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getConfiguracao, salvarConfiguracao } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import { getErrorMessage } from '../utils/errorMessages';
import './Configuracoes.css';

function Configuracoes() {
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDescricao, setWebhookDescricao] = useState('Webhook para receber notificações de novos cadastros');
  const [saving, setSaving] = useState(false);
  const { toast, showSuccess, showError, hideToast } = useToast();

  const loadConfiguracoes = useCallback(async () => {
    try {
      setLoading(true);
      // Buscar diretamente a configuração do webhook (mais confiável do que listar tudo)
      try {
        const response = await getConfiguracao('webhook_cadastro');
        if (response?.data) {
          setWebhookUrl(response.data.valor || '');
          setWebhookDescricao(response.data.descricao || 'Webhook para receber notificações de novos cadastros');
        }
      } catch (err) {
        // Se ainda não existir, backend retorna 404 -> manter vazio sem tratar como erro
        if (err?.response?.status !== 404) {
          throw err;
        }
        setWebhookUrl('');
        setWebhookDescricao('Webhook para receber notificações de novos cadastros');
      }
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadConfiguracoes();
  }, [loadConfiguracoes]);

  const handleSalvarWebhook = async (e) => {
    e.preventDefault();
    
    try {
      if (saving) return;
      setSaving(true);
      const url = (webhookUrl || '').trim();
      const desc = (webhookDescricao || '').trim();

      if (!url) {
        showError('Informe a URL do webhook.');
        return;
      }

      await salvarConfiguracao('webhook_cadastro', url, desc);
      showSuccess('Webhook salvo com sucesso!');
      
      // Recarregar configurações
      await loadConfiguracoes();
    } catch (error) {
      showError(getErrorMessage(error) || 'Não foi possível salvar o webhook. Verifique sua conexão e permissões.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestarWebhook = async () => {
    if (!webhookUrl) {
      showError('Configure o webhook antes de testar');
      return;
    }

    try {
      // Enviar um teste
      const payload = {
        tipo: 'teste_webhook',
        timestamp: new Date().toISOString(),
        mensagem: 'Este é um teste do webhook de cadastro',
        teste: true
      };
      
      await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      showSuccess('Webhook testado com sucesso! Verifique se recebeu a notificação.');
    } catch (error) {
      showError(`Erro ao testar webhook: ${error.message}`);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando configurações..." />;
  }

  return (
    <div className="configuracoes">
      {toast?.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
          duration={toast.duration}
        />
      )}
      
      <div className="page-header">
        <h2>⚙️ Configurações do Sistema</h2>
      </div>

      <div className="card">
        <h3 className="card__title">Webhook de Cadastro</h3>
        <p className="card__description">
          Configure um webhook para receber notificações sempre que um novo usuário se cadastrar no sistema.
          O webhook receberá todos os dados do cadastro para que você possa aprovar ou rejeitar.
        </p>

        <form onSubmit={handleSalvarWebhook} className="configuracoes__form">
          <div className="form-group">
            <label htmlFor="webhook-url">URL do Webhook *</label>
            <input
              id="webhook-url"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://seu-servidor.com/webhook/cadastro"
              required
              className="form-control"
            />
            <small className="form-hint">
              URL completa do endpoint que receberá as notificações de cadastro
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="webhook-descricao">Descrição</label>
            <input
              id="webhook-descricao"
              type="text"
              value={webhookDescricao}
              onChange={(e) => setWebhookDescricao(e.target.value)}
              placeholder="Descrição do webhook"
              className="form-control"
            />
          </div>

          <div className="configuracoes__actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Webhook'}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleTestarWebhook}
              disabled={!webhookUrl || saving}
            >
              Testar Webhook
            </button>
          </div>
        </form>

        <div className="configuracoes__info">
          <h4>📋 Formato do Payload</h4>
          <p>O webhook receberá um JSON com a seguinte estrutura:</p>
          <pre className="configuracoes__code">
{`{
  "tipo": "novo_cadastro",
  "timestamp": "2026-01-26T15:30:00.000Z",
  "timestamp_br": "26/01/2026 15:30:00",
  "usuario": {
    "id": 123,
    "nome": "João Silva",
    "email": "joao@example.com",
    "telefone": "(11) 99999-9999",
    "tipo_usuario": "encarregado",
    "igreja": "Bairro do Cruzeiro",
    "igreja_id": 45,
    "aprovado": false,
    "created_at": "2026-01-26T15:30:00.000Z"
  },
  "mensagem": "Novo cadastro: João Silva (joao@example.com) aguardando aprovação"
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default Configuracoes;
