import React, { useState, useEffect } from 'react';
import { getOrganistas, createOrganista, updateOrganista, deleteOrganista, getIgrejas, getOrganistasIgreja } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { getErrorMessage } from '../utils/errorMessages';
import { validateForm, validateRequired, validateEmail, validatePhone, validateMinLength } from '../utils/formValidation';
import Modal from '../components/Modal';

function Organistas({ user }) {
  const [organistas, setOrganistas] = useState([]);
  const [organistasFiltradas, setOrganistasFiltradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filtroIgreja, setFiltroIgreja] = useState('');
  const [igrejas, setIgrejas] = useState([]);
  const [formData, setFormData] = useState({
    ordem: '',
    nome: '',
    telefone: '',
    email: '',
    oficializada: false,
    ativa: true
  });
  const { toast, showSuccess, showError, hideToast } = useToast();

  useEffect(() => {
    loadOrganistas();
    if (user?.role === 'admin') {
      loadIgrejas();
    }
  }, [user]);

  useEffect(() => {
    // Só aplicar filtro se já tiver carregado as organistas inicialmente
    if (organistas.length > 0 || filtroIgreja) {
      if (filtroIgreja) {
        loadOrganistasPorIgreja(filtroIgreja);
      } else {
        setOrganistasFiltradas(organistas);
      }
    }
  }, [filtroIgreja]);

  const loadOrganistas = async () => {
    try {
      setLoading(true);
      const response = await getOrganistas();
      setOrganistas(response.data);
      setOrganistasFiltradas(response.data);
    } catch (error) {
      // Mensagem de erro amigável
      const errorMessage = getErrorMessage(error);
      console.error('[Organistas] Erro ao carregar:', error);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganistasPorIgreja = async (igrejaId) => {
    try {
      setLoading(true);
      const response = await getOrganistasIgreja(igrejaId);
      setOrganistasFiltradas(response.data);
    } catch (error) {
      console.error('[Organistas] Erro ao carregar organistas da igreja:', error);
      showError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const loadIgrejas = async () => {
    try {
      const response = await getIgrejas();
      setIgrejas(response.data);
    } catch (error) {
      console.error('[Organistas] Erro ao carregar igrejas:', error);
    }
  };

  // showAlert substituído por useToast

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    
    // Validação no frontend
    const validation = validateForm(formData, {
      nome: [
        (v) => validateRequired(v, 'Nome'),
        (v) => validateMinLength(v, 3, 'Nome')
      ],
      email: [
        (v) => validateEmail(v)
      ],
      telefone: [
        (v) => validatePhone(v)
      ]
    });
    
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      showError(firstError);
      return;
    }
    
    try {
      setSaving(true);
      if (editing) {
        await updateOrganista(editing.id, formData);
        showSuccess('Organista atualizada com sucesso!');
      } else {
        await createOrganista(formData);
        showSuccess('Organista cadastrada com sucesso!');
      }
      resetForm();
      if (filtroIgreja) {
        loadOrganistasPorIgreja(filtroIgreja);
      } else {
        loadOrganistas();
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao salvar organista:', error);
      showError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (organista) => {
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
        showSuccess('Organista deletada com sucesso!');
        if (filtroIgreja) {
          loadOrganistasPorIgreja(filtroIgreja);
        } else {
          loadOrganistas();
        }
      } catch (error) {
        showError(getErrorMessage(error));
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

  const closeEditModal = () => {
    resetForm();
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

        <Toast 
          message={toast?.message} 
          type={toast?.type} 
          onClose={hideToast}
          duration={toast?.duration}
        />

        {showForm && !editing && (
          <form onSubmit={handleSubmit} className="form--spaced">
            <div className="form-group">
              <label>Numeração (ordem do rodízio)</label>
              <input
                type="number"
                value={formData.ordem}
                onChange={(e) => setFormData({ ...formData, ordem: e.target.value })}
                placeholder="Ex: 1"
                min="1"
              />
              <small className="form-hint">
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
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  id="oficializada"
                  checked={formData.oficializada}
                  onChange={(e) => setFormData({ ...formData, oficializada: e.target.checked })}
                  className="checkbox-input"
                />
                <span className="checkbox-label-text">Oficializada</span>
              </label>
            </div>
            <div className="form-group">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  id="ativa"
                  checked={formData.ativa}
                  onChange={(e) => setFormData({ ...formData, ativa: e.target.checked })}
                  className="checkbox-input"
                />
                <span className="checkbox-label-text">Ativa</span>
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              {saving ? 'Salvando...' : (editing ? 'Atualizar' : 'Salvar')}
            </button>
          </form>
        )}

        <Modal isOpen={showForm && editing} title="Editar Organista" onClose={closeEditModal}>
          <form onSubmit={handleSubmit} className="form--spaced">
            <div className="form-group">
              <label>Numeração (ordem do rodízio)</label>
              <input
                type="number"
                value={formData.ordem}
                onChange={(e) => setFormData({ ...formData, ordem: e.target.value })}
                placeholder="Ex: 1"
                min="1"
              />
              <small className="form-hint">
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
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  id="oficializada"
                  checked={formData.oficializada}
                  onChange={(e) => setFormData({ ...formData, oficializada: e.target.checked })}
                  className="checkbox-input"
                />
                <span className="checkbox-label-text">Oficializada</span>
              </label>
            </div>
            <div className="form-group">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  id="ativa"
                  checked={formData.ativa}
                  onChange={(e) => setFormData({ ...formData, ativa: e.target.checked })}
                  className="checkbox-input"
                />
                <span className="checkbox-label-text">Ativa</span>
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              {saving ? 'Salvando...' : 'Atualizar'}
            </button>
          </form>
        </Modal>

        {user?.role === 'admin' && (
          <div className="filter-row">
            <label>Filtrar por Igreja</label>
            <select
              value={filtroIgreja}
              onChange={(e) => setFiltroIgreja(e.target.value)}
              className="filter-select"
            >
              <option value="">Todas as igrejas</option>
              {igrejas.map(igreja => (
                <option key={igreja.id} value={igreja.id}>
                  {igreja.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {organistasFiltradas.length === 0 ? (
          <div className="empty">Nenhuma organista {filtroIgreja ? 'nesta igreja' : 'cadastrada'}</div>
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
                {organistasFiltradas.map(organista => (
                  <tr key={organista.id}>
                    <td data-label="Nº" className="table__cell--bold">{organista.ordem ?? '-'}</td>
                    <td data-label="Nome" className="table__cell--break">{organista.nome}</td>
                    <td data-label="Telefone">{organista.telefone || '-'}</td>
                    <td data-label="Email" className="table__cell--break">{organista.email || '-'}</td>
                    <td data-label="Oficializada">{organista.oficializada === 1 ? 'Sim' : 'Não'}</td>
                    <td data-label="Ativa">{organista.ativa === 1 ? 'Sim' : 'Não'}</td>
                    <td data-label="Ações">
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={(event) => {
                            event.preventDefault();
                            openEditModal(organista);
                          }}
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
