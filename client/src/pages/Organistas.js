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
      showAlert('Erro ao carregar organistas', 'error');
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.oficializada}
                  onChange={(e) => setFormData({ ...formData, oficializada: e.target.checked })}
                />
                {' '}Oficializada
              </label>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.ativa}
                  onChange={(e) => setFormData({ ...formData, ativa: e.target.checked })}
                />
                {' '}Ativa
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
                  <td style={{ fontWeight: '600' }}>{organista.ordem ?? '-'}</td>
                  <td>{organista.nome}</td>
                  <td>{organista.telefone || '-'}</td>
                  <td>{organista.email || '-'}</td>
                  <td>{organista.oficializada === 1 ? 'Sim' : 'Não'}</td>
                  <td>{organista.ativa === 1 ? 'Sim' : 'Não'}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleEdit(organista)}
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(organista.id)}
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                      >
                        Deletar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Organistas;
