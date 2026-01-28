import React, { useState, useEffect } from 'react';
import { getTenants, createTenant, updateTenant, deleteTenant } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import { getErrorMessage } from '../../utils/errorMessages';
import useToast from '../../hooks/useToast';
import Toast from '../Toast';
import './TenantsManagement.css';

function TenantsManagement() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    slug: '',
    ativo: true
  });
  const { toast, showSuccess, showError, hideToast } = useToast();

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const res = await getTenants();
      setTenants(res.data);
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateTenant(editing.id, formData);
        showSuccess('Tenant atualizado com sucesso!');
      } else {
        await createTenant(formData);
        showSuccess('Tenant criado com sucesso!');
      }
      resetForm();
      loadTenants();
    } catch (error) {
      showError(getErrorMessage(error));
    }
  };

  const handleEdit = (tenant) => {
    setEditing(tenant);
    setFormData({
      nome: tenant.nome,
      slug: tenant.slug,
      ativo: tenant.ativo === 1
    });
    setShowForm(true);
  };

  const handleDelete = async (id, slug) => {
    if (slug === 'default') {
      showError('Não é possível deletar o tenant padrão');
      return;
    }
    if (!window.confirm('Tem certeza que deseja deletar este tenant?')) {
      return;
    }
    try {
      await deleteTenant(id);
      showSuccess('Tenant deletado com sucesso!');
      loadTenants();
    } catch (error) {
      showError(getErrorMessage(error));
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      slug: '',
      ativo: true
    });
    setEditing(null);
    setShowForm(false);
  };

  const generateSlug = (nome) => {
    return nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNomeChange = (nome) => {
    setFormData(prev => ({
      ...prev,
      nome,
      slug: editing ? prev.slug : generateSlug(nome)
    }));
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando tenants..." />;
  }

  return (
    <div className="tenants-management">
      <div className="card">
        <div className="tenants-management__header">
          <h2>Gerenciar Tenants</h2>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
            + Novo Tenant
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="tenants-management__form">
            <h3>{editing ? 'Editar Tenant' : 'Novo Tenant'}</h3>
            
            <div className="form-group">
              <label>Nome *</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => handleNomeChange(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Slug *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
                pattern="[a-z0-9-]+"
                placeholder="exemplo-tenant"
              />
              <small className="form-group__hint">Apenas letras minúsculas, números e hífens</small>
            </div>

            <div className="form-group form-group--checkbox">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
              />
              <label htmlFor="ativo">Ativo</label>
            </div>

            <div className="tenants-management__form-actions">
              <button type="submit" className="btn btn-primary">
                {editing ? 'Atualizar' : 'Criar'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Slug</th>
                <th>Usuários</th>
                <th>Igrejas</th>
                <th>Organistas</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(tenant => (
                <tr key={tenant.id}>
                  <td>{tenant.id}</td>
                  <td>{tenant.nome}</td>
                  <td><code>{tenant.slug}</code></td>
                  <td>{tenant.total_usuarios || 0}</td>
                  <td>{tenant.total_igrejas || 0}</td>
                  <td>{tenant.total_organistas || 0}</td>
                  <td>
                    <span className={`badge badge-${tenant.ativo === 1 ? 'success' : 'danger'}`}>
                      {tenant.ativo === 1 ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleEdit(tenant)}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      {tenant.slug !== 'default' && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(tenant.id, tenant.slug)}
                          title="Deletar"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
}

export default TenantsManagement;
