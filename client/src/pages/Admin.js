import React, { useState, useEffect } from 'react';
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario, aprovarUsuario, rejeitarUsuario } from '../services/api';
import { getIgrejas } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { getErrorMessage } from '../utils/errorMessages';

function Admin() {
  const [usuarios, setUsuarios] = useState([]);
  const [igrejas, setIgrejas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    role: 'usuario',
    ativo: true,
    aprovado: true,
    igreja_ids: []
  });
  const [filtroAprovacao, setFiltroAprovacao] = useState('todos'); // 'todos', 'pendentes', 'aprovados'
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalPosition, setModalPosition] = useState(null);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usuariosRes, igrejasRes] = await Promise.all([
        getUsuarios(),
        getIgrejas()
      ]);
      setUsuarios(usuariosRes.data);
      setIgrejas(igrejasRes.data);
    } catch (error) {
      showAlert(getErrorMessage(error), 'error');
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
    try {
      await createUsuario(formData);
      showAlert('Usuário criado com sucesso!');
      resetForm();
      loadData();
    } catch (error) {
      showAlert(getErrorMessage(error), 'error');
    }
  };

  const calculateModalPosition = (event) => {
    const padding = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const modalWidth = Math.min(760, Math.max(320, viewportWidth - padding * 2));
    const modalHeight = Math.min(Math.floor(viewportHeight * 0.9), 640);
    const clickX = event?.clientX ?? viewportWidth / 2;
    const clickY = event?.clientY ?? viewportHeight / 2;
    const spaceBelow = viewportHeight - clickY;
    const spaceAbove = clickY;
    let top;
    if (spaceBelow >= modalHeight + padding) {
      top = clickY + 8;
    } else if (spaceAbove >= modalHeight + padding) {
      top = clickY - modalHeight - 8;
    } else {
      top = Math.max(padding, (viewportHeight - modalHeight) / 2);
    }
    const left = Math.min(
      Math.max(clickX - modalWidth / 2, padding),
      viewportWidth - modalWidth - padding
    );
    return {
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(modalWidth)
    };
  };

  const handleEdit = (event, usuario) => {
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
    setModalPosition(calculateModalPosition(event));
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setModalPosition(null);
    setShowEditModal(false);
    setEditing(null);
    resetForm();
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = { ...formData };
      if (!dataToSend.senha || dataToSend.senha.trim() === '') {
        delete dataToSend.senha;
      }
      await updateUsuario(editing.id, dataToSend);
      showAlert('Usuário atualizado com sucesso!');
      handleCloseEditModal();
      loadData();
    } catch (error) {
      showAlert(getErrorMessage(error), 'error');
    }
  };

  const handleAprovar = async (id) => {
    try {
      await aprovarUsuario(id);
      showAlert('Usuário aprovado com sucesso!');
      loadData();
    } catch (error) {
      showAlert(error.response?.data?.error || 'Erro ao aprovar usuário', 'error');
    }
  };

  const handleRejeitar = async (id) => {
    if (window.confirm('Tem certeza que deseja rejeitar este usuário? Ele não poderá acessar o sistema.')) {
      try {
        await rejeitarUsuario(id);
        showAlert('Usuário rejeitado');
        loadData();
      } catch (error) {
        showAlert(getErrorMessage(error), 'error');
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar este usuário?')) {
      try {
        await deleteUsuario(id);
        showAlert('Usuário deletado com sucesso!');
        loadData();
      } catch (error) {
        showAlert(getErrorMessage(error), 'error');
      }
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

  const toggleIgreja = (igrejaId) => {
    setFormData(prev => ({
      ...prev,
      igreja_ids: prev.igreja_ids.includes(igrejaId)
        ? prev.igreja_ids.filter(id => id !== igrejaId)
        : [...prev.igreja_ids, igrejaId]
    }));
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando usuários..." />;
  }

  return (
    <div>
      <div className="card">
        <div className="admin__filters">
          <h2 className="admin__title">Gerenciar Usuários</h2>
          <div className="admin__search-wrapper">
            <input
              type="text"
              placeholder="Pesquisar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin__search-input"
            />
            <select
              value={filtroAprovacao}
              onChange={(e) => setFiltroAprovacao(e.target.value)}
              className="admin__filter-select"
            >
              <option value="todos">Todos</option>
              <option value="pendentes">Pendentes de Aprovação</option>
              <option value="aprovados">Aprovados</option>
            </select>
            <button 
              className="btn btn-primary btn-nowrap" 
              onClick={() => {
                if (showForm) {
                  resetForm();
                } else {
                  setShowForm(true);
                }
              }} 
            >
              {showForm ? 'Cancelar' : '+ Novo Usuário'}
            </button>
          </div>
        </div>

        {alert && (
          <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
            {alert.message}
          </div>
        )}

        {showForm && !editing && (
          <form onSubmit={handleSubmit} className="form--spaced">
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
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Senha *</label>
              <input
                type="password"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Perfil *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
              >
                <option value="usuario">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="form-group">
              <div className="form-group--checkbox">
                <input
                  type="checkbox"
                  id="usuario_ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="checkbox-input"
                />
                <label htmlFor="usuario_ativo" className="checkbox-label">Ativo</label>
              </div>
            </div>
            {formData.role === 'usuario' && (
              <div className="form-group">
                <div className="form-group--checkbox">
                  <input
                    type="checkbox"
                    id="usuario_aprovado"
                    checked={formData.aprovado}
                    onChange={(e) => setFormData({ ...formData, aprovado: e.target.checked })}
                    className="checkbox-input"
                  />
                  <label htmlFor="usuario_aprovado" className="checkbox-label">Aprovado</label>
                </div>
              </div>
            )}
            
            {formData.role === 'usuario' && (
              <div className="form-group">
                <label>Igrejas (selecione as igrejas que este usuário pode gerenciar)</label>
                <div className="checklist">
                  {igrejas.map(igreja => (
                    <label key={igreja.id} className="checklist-item">
                      <input
                        type="checkbox"
                        checked={formData.igreja_ids.includes(igreja.id)}
                        onChange={() => toggleIgreja(igreja.id)}
                      />
                      <span>{igreja.nome}</span>
                    </label>
                  ))}
                  {igrejas.length === 0 && (
                    <p className="muted-italic">Nenhuma igreja cadastrada</p>
                  )}
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-primary">
              Criar
            </button>
          </form>
        )}

        {(() => {
          const usuariosFiltrados = usuarios.filter(usuario => {
            // Filtro por aprovação
            if (filtroAprovacao === 'pendentes' && usuario.aprovado !== 0) return false;
            if (filtroAprovacao === 'aprovados' && usuario.aprovado !== 1) return false;
            
            // Filtro por nome (pesquisa)
            if (searchTerm.trim() !== '') {
              const nomeMatch = usuario.nome.toLowerCase().includes(searchTerm.toLowerCase());
              if (!nomeMatch) return false;
            }
            
            return true;
          });

          return usuariosFiltrados.length === 0 ? (
            <div className="empty">
              {filtroAprovacao === 'pendentes' 
                ? 'Nenhum usuário pendente de aprovação' 
                : filtroAprovacao === 'aprovados'
                ? 'Nenhum usuário aprovado'
                : 'Nenhum usuário cadastrado'}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Perfil</th>
                    <th>Igrejas</th>
                    <th>Status</th>
                    <th>Ativo</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map(usuario => (
                    <tr key={usuario.id} className={usuario.aprovado === 0 ? 'row-highlight' : ''}>
                      <td data-label="Nome" className="table__cell--break">{usuario.nome}</td>
                      <td data-label="Email" className="table__cell--break">{usuario.email}</td>
                      <td data-label="Perfil">{usuario.role === 'admin' ? 'Administrador' : 'Usuário'}</td>
                      <td data-label="Igrejas" className="table__cell--break">{usuario.igrejas_nomes || '-'}</td>
                      <td data-label="Status">
                        {usuario.role === 'admin' ? (
                          <span className="td-strong">Aprovado</span>
                        ) : usuario.aprovado === 1 ? (
                          <span className="td-strong">✓ Aprovado</span>
                        ) : (
                          <span className="td-strong">⏳ Pendente</span>
                        )}
                      </td>
                      <td data-label="Ativo">{usuario.ativo === 1 ? 'Sim' : 'Não'}</td>
                      <td>
                        <div className="actions actions-inline">
                          {usuario.role !== 'admin' && usuario.aprovado === 0 && (
                            <>
                              <button
                                className="btn btn-compact-wide btn-solid-success"
                                onClick={() => handleAprovar(usuario.id)}
                              >
                                ✓ Aprovar
                              </button>
                              <button
                                className="btn btn-compact-wide btn-solid-danger"
                                onClick={() => handleRejeitar(usuario.id)}
                              >
                                ✗ Rejeitar
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={(event) => {
                              event.preventDefault();
                              handleEdit(event, usuario);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-danger btn-compact"
                            onClick={() => handleDelete(usuario.id)}
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
          );
        })()}

        {/* Modal de Edição */}
        {showEditModal && editing && (
          <div className="modal-overlay">
            <div
              className={`card modal-panel ${modalPosition ? 'modal-panel--anchored' : ''}`}
              style={modalPosition ? { top: modalPosition.top, left: modalPosition.left, width: modalPosition.width } : undefined}
            >
              <div className="modal-header">
                <h2 className="modal-title">Editar Usuário</h2>
                <button className="btn btn-secondary btn-nowrap" onClick={handleCloseEditModal}>
                  Fechar
                </button>
              </div>

              <form onSubmit={handleSubmitEdit}>
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
                  <label>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nova Senha (deixe em branco para manter a atual)</label>
                  <input
                    type="password"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    placeholder="Deixe em branco para manter"
                  />
                </div>
                <div className="form-group">
                  <label>Perfil *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    required
                  >
                    <option value="usuario">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="form-group">
                  <div className="form-group--checkbox">
                    <input
                      type="checkbox"
                      id="edit_usuario_ativo"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                      className="checkbox-input"
                    />
                    <label htmlFor="edit_usuario_ativo" className="checkbox-label">Ativo</label>
                  </div>
                </div>
                {formData.role === 'usuario' && (
                  <div className="form-group">
                    <div className="form-group--checkbox">
                      <input
                        type="checkbox"
                        id="edit_usuario_aprovado"
                        checked={formData.aprovado}
                        onChange={(e) => setFormData({ ...formData, aprovado: e.target.checked })}
                        className="checkbox-input"
                      />
                      <label htmlFor="edit_usuario_aprovado" className="checkbox-label">Aprovado</label>
                    </div>
                  </div>
                )}
                
                {formData.role === 'usuario' && (
                  <div className="form-group">
                    <label>Igrejas (selecione as igrejas que este usuário pode gerenciar)</label>
                    <div className="checklist">
                      {igrejas.map(igreja => (
                        <label key={igreja.id} className="checklist-item">
                          <input
                            type="checkbox"
                            checked={formData.igreja_ids.includes(igreja.id)}
                            onChange={() => toggleIgreja(igreja.id)}
                          />
                          <span>{igreja.nome}</span>
                        </label>
                      ))}
                      {igrejas.length === 0 && (
                        <p className="muted-italic">Nenhuma igreja cadastrada</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="btn-row">
                  <button type="submit" className="btn btn-primary">
                    Atualizar
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleCloseEditModal}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
