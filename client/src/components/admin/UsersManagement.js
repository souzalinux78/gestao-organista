import React, { useState, useEffect, useRef } from 'react';
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario, resetPassword } from '../../services/api';
import { getIgrejas } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import { getErrorMessage } from '../../utils/errorMessages';
import useToast from '../../hooks/useToast';
import Toast from '../Toast';
import './UsersManagement.css';

function UsersManagement() {
  const [usuarios, setUsuarios] = useState([]);
  const [igrejas, setIgrejas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showResetPassword, setShowResetPassword] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    role: 'usuario',
    ativo: true,
    aprovado: true,
    igreja_ids: []
  });
  const [searchTerm, setSearchTerm] = useState('');
  const { toast, showSuccess, showError, hideToast } = useToast();
  const firstInputRef = useRef(null);
  const isEditModalOpen = showForm && !!editing;

  useEffect(() => {
    if (!isEditModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeEditModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    requestAnimationFrame(() => {
      firstInputRef.current?.focus();
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditModalOpen]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usuariosRes, igrejasRes] = await Promise.all([
        getUsuarios(),
        getIgrejas()
      ]);
      setUsuarios(usuariosRes.data);
      setIgrejas(igrejasRes.data);
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
        const dataToSend = { ...formData };
        if (!dataToSend.senha || dataToSend.senha.trim() === '') {
          delete dataToSend.senha;
        }
        await updateUsuario(editing.id, dataToSend);
        showSuccess('Usuário atualizado com sucesso!');
      } else {
        await createUsuario(formData);
        showSuccess('Usuário criado com sucesso!');
      }
      resetForm();
      loadData();
    } catch (error) {
      showError(getErrorMessage(error));
    }
  };

  const openEditModal = (usuario) => {
    setEditing(usuario);
    setFormData({
      nome: usuario.nome,
      email: usuario.email,
      senha: '',
      role: usuario.role,
      ativo: usuario.ativo === 1,
      aprovado: usuario.aprovado === 1,
      igreja_ids: usuario.igrejas_ids || []
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja deletar este usuário?')) {
      return;
    }
    try {
      await deleteUsuario(id);
      showSuccess('Usuário deletado com sucesso!');
      loadData();
    } catch (error) {
      showError(getErrorMessage(error));
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordValue || resetPasswordValue.length < 6) {
      showError('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    try {
      await resetPassword(showResetPassword, resetPasswordValue);
      showSuccess('Senha resetada com sucesso!');
      setShowResetPassword(null);
      setResetPasswordValue('');
    } catch (error) {
      showError(getErrorMessage(error));
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      email: '',
      senha: '',
      role: 'usuario',
      ativo: true,
      aprovado: true,
      igreja_ids: []
    });
    setEditing(null);
    setShowForm(false);
  };

  const closeEditModal = () => {
    resetForm();
  };

  const toggleIgreja = (igrejaId) => {
    setFormData(prev => ({
      ...prev,
      igreja_ids: prev.igreja_ids.includes(igrejaId)
        ? prev.igreja_ids.filter(id => id !== igrejaId)
        : [...prev.igreja_ids, igrejaId]
    }));
  };

  const filteredUsuarios = usuarios.filter(usuario =>
    usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando usuários..." />;
  }

  return (
    <div className="users-management">
      <div className="card">
        <div className="users-management__header">
          <h2>Gerenciar Usuários</h2>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
            + Novo Usuário
          </button>
        </div>

        <div className="users-management__search">
          <input
            type="text"
            placeholder="Pesquisar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-group input"
          />
        </div>

        {showForm && !editing && (
          <form onSubmit={handleSubmit} className="users-management__form">
            <h3>{editing ? 'Editar Usuário' : 'Novo Usuário'}</h3>
            
            <div className="form-group">
              <label>Nome *</label>
              <input
                type="text"
                ref={firstInputRef}
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Senha {!editing && '*'}</label>
              <input
                type="password"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                required={!editing}
                placeholder={editing ? 'Deixe em branco para não alterar' : ''}
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="usuario">Usuário</option>
                <option value="admin">Admin</option>
              </select>
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

            <div className="form-group form-group--checkbox">
              <input
                type="checkbox"
                id="aprovado"
                checked={formData.aprovado}
                onChange={(e) => setFormData({ ...formData, aprovado: e.target.checked })}
              />
              <label htmlFor="aprovado">Aprovado</label>
            </div>

            <div className="form-group">
              <label>Igrejas</label>
              <div className="users-management__igrejas-list">
                {igrejas.map(igreja => (
                  <label key={igreja.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.igreja_ids.includes(igreja.id)}
                      onChange={() => toggleIgreja(igreja.id)}
                    />
                    {igreja.nome}
                  </label>
                ))}
              </div>
            </div>

            <div className="users-management__form-actions">
              <button type="submit" className="btn btn-primary">
                {editing ? 'Atualizar' : 'Criar'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {showForm && editing && (
          <div className="modal-overlay" onClick={closeEditModal}>
            <div className="card modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Editar Usuário</h2>
                <button type="button" className="btn btn-secondary modal-close" onClick={closeEditModal} aria-label="Fechar">
                  ✕
                </button>
              </div>
              <form onSubmit={handleSubmit} className="users-management__form">
                <div className="form-group">
                  <label>Nome *</label>
                  <input
                    type="text"
                    ref={firstInputRef}
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Senha {!editing && '*'}</label>
                  <input
                    type="password"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    required={!editing}
                    placeholder={editing ? 'Deixe em branco para não alterar' : ''}
                  />
                </div>

                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="usuario">Usuário</option>
                    <option value="admin">Admin</option>
                  </select>
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

                <div className="form-group form-group--checkbox">
                  <input
                    type="checkbox"
                    id="aprovado"
                    checked={formData.aprovado}
                    onChange={(e) => setFormData({ ...formData, aprovado: e.target.checked })}
                  />
                  <label htmlFor="aprovado">Aprovado</label>
                </div>

                <div className="form-group">
                  <label>Igrejas</label>
                  <div className="users-management__igrejas-list">
                    {igrejas.map(igreja => (
                      <label key={igreja.id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.igreja_ids.includes(igreja.id)}
                          onChange={() => toggleIgreja(igreja.id)}
                        />
                        {igreja.nome}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="users-management__form-actions">
                  <button type="submit" className="btn btn-primary">
                    Atualizar
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={closeEditModal}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsuarios.map(usuario => (
                <tr key={usuario.id}>
                  <td>{usuario.id}</td>
                  <td>{usuario.nome}</td>
                  <td>{usuario.email}</td>
                  <td>
                    <span className={`badge badge-${usuario.role === 'admin' ? 'primary' : 'secondary'}`}>
                      {usuario.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${usuario.ativo === 1 ? 'success' : 'danger'}`}>
                      {usuario.ativo === 1 ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={(event) => {
                          event.preventDefault();
                          openEditModal(usuario);
                        }}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => setShowResetPassword(usuario.id)}
                        title="Resetar Senha"
                      >
                        🔑
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(usuario.id)}
                        title="Deletar"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showResetPassword && (
        <div className="modal-overlay" onClick={() => setShowResetPassword(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Resetar Senha</h3>
            <div className="form-group">
              <label>Nova Senha *</label>
              <input
                type="password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleResetPassword}>
                Resetar
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowResetPassword(null); setResetPasswordValue(''); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} onClose={hideToast} />}
    </div>
  );
}

export default UsersManagement;
