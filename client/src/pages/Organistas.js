import React, { useState, useEffect } from 'react';
import { getOrganistas, createOrganista, updateOrganista, deleteOrganista } from '../services/api';

function Organistas() {
  const [organistas, setOrganistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    ordem: '',
    nome: '',
    telefone: '',
    email: '',
    oficializada: false,
    ativa: true
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadOrganistas();
  }, []);

  const loadOrganistas = async () => {
    try {
      const response = await getOrganistas();
      setOrganistas(response.data);
    } catch (error) {
      // Mensagem de erro mais específica
      let errorMessage = 'Erro ao carregar organistas';
      
      if (error.isServerError) {
        errorMessage = 'Servidor temporariamente indisponível. Verifique se o backend está rodando.';
      } else if (error.isTimeout) {
        errorMessage = 'Tempo limite excedido. Tente novamente.';
      } else if (error.isNetworkError) {
        errorMessage = 'Erro de conexão. Verifique sua internet.';
      } else if (error.response?.status === 502 || error.response?.status === 503) {
        errorMessage = 'Servidor indisponível (502). Verifique se o backend está rodando na porta 5001.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error('[Organistas] Erro ao carregar:', error);
      showAlert(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      if (editing) {
        await updateOrganista(editing.id, formData);
        showAlert('Organista atualizada com sucesso!');
      } else {
        await createOrganista(formData);
        showAlert('Organista cadastrada com sucesso!');
      }
      resetForm();
      loadOrganistas();
    } catch (error) {
      // Mostrar a mensagem real vinda do backend (se existir)
      const errorMessage = (error?.code === 'ECONNABORTED')
        ? 'Tempo limite ao salvar. O servidor demorou para responder (15s). Tente novamente.'
        :
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Erro ao salvar organista';

      console.error('[DEBUG] Erro ao salvar organista:', error);
      showAlert(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (organista) => {
    setEditing(organista);
    setFormData({
      ordem: organista.ordem ?? '',
      nome: organista.nome,
      telefone: organista.telefone || '',
      email: organista.email || '',
      oficializada: organista.oficializada === 1,
      ativa: organista.ativa === 1
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar esta organista?')) {
      try {
        await deleteOrganista(id);
        showAlert('Organista deletada com sucesso!');
        loadOrganistas();
      } catch (error) {
        showAlert('Erro ao deletar organista', 'error');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      ordem: '',
      nome: '',
      telefone: '',
      email: '',
      oficializada: false,
      ativa: true
    });
    setEditing(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="page-header">
          <h2>Organistas</h2>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : '+ Nova Organista'}
          </button>
        </div>

        {alert && (
          <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
            {alert.message}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
            <div className="form-group">
              <label>Numeração (ordem do rodízio)</label>
              <input
                type="number"
                value={formData.ordem}
                onChange={(e) => setFormData({ ...formData, ordem: e.target.value })}
                placeholder="Ex: 1"
                min="1"
              />
              <small style={{ display: 'block', marginTop: '6px', color: '#666' }}>
                Use 1,2,3... para definir a ordem do rodízio. Se deixar vazio, a organista fica sem numeração.
              </small>
            </div>
            <div className="form-group">
              <label>Nome *</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Telefone</label>
              <input
                type="text"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={formData.oficializada}
                  onChange={(e) => setFormData({ ...formData, oficializada: e.target.checked })}
                  style={{ 
                    width: '20px', 
                    height: '20px', 
                    cursor: 'pointer',
                    margin: 0
                  }}
                />
                <span style={{ fontSize: '16px', fontWeight: '500' }}>Oficializada</span>
              </label>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={formData.ativa}
                  onChange={(e) => setFormData({ ...formData, ativa: e.target.checked })}
                  style={{ 
                    width: '20px', 
                    height: '20px', 
                    cursor: 'pointer',
                    margin: 0
                  }}
                />
                <span style={{ fontSize: '16px', fontWeight: '500' }}>Ativa</span>
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              {saving ? 'Salvando...' : (editing ? 'Atualizar' : 'Salvar')}
            </button>
          </form>
        )}

        {organistas.length === 0 ? (
          <div className="empty">Nenhuma organista cadastrada</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Email</th>
                  <th>Oficializada</th>
                  <th>Ativa</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {organistas.map(organista => (
                  <tr key={organista.id}>
                    <td data-label="Nº" style={{ fontWeight: '600' }}>{organista.ordem ?? '-'}</td>
                    <td data-label="Nome" style={{ wordBreak: 'break-word' }}>{organista.nome}</td>
                    <td data-label="Telefone">{organista.telefone || '-'}</td>
                    <td data-label="Email" style={{ wordBreak: 'break-word' }}>{organista.email || '-'}</td>
                    <td data-label="Oficializada">{organista.oficializada === 1 ? 'Sim' : 'Não'}</td>
                    <td data-label="Ativa">{organista.ativa === 1 ? 'Sim' : 'Não'}</td>
                    <td data-label="Ações">
                      <div className="actions">
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleEdit(organista)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(organista.id)}
                        >
                          Deletar
                        </button>
                      </div>
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

export default Organistas;
