import React, { useState, useEffect } from 'react';
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario, aprovarUsuario, rejeitarUsuario } from '../services/api';
import { getIgrejas } from '../services/api';

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
      showAlert('Erro ao carregar dados', 'error');
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
      showAlert(error.response?.data?.error || 'Erro ao criar usuário', 'error');
    }
  };

  const handleEdit = (usuario) => {
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
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
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
      showAlert(error.response?.data?.error || 'Erro ao atualizar usuário', 'error');
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
        showAlert(error.response?.data?.error || 'Erro ao rejeitar usuário', 'error');
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
        showAlert('Erro ao deletar usuário', 'error');
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
    return <div className="loading">Carregando...</div>;
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, flex: '1 1 auto', minWidth: '200px' }}>Gerenciar Usuários</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: '0 1 auto' }}>
            <input
              type="text"
              placeholder="Pesquisar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                padding: '8px 12px', 
                borderRadius: '10px', 
                border: '2px solid var(--gray-medium)', 
                fontSize: '16px', 
                minWidth: '200px',
                flex: '1 1 auto'
              }}
            />
            <select
              value={filtroAprovacao}
              onChange={(e) => setFiltroAprovacao(e.target.value)}
              style={{ padding: '8px', borderRadius: '10px', border: '2px solid var(--gray-medium)', fontSize: '16px', minWidth: '150px' }}
            >
              <option value="todos">Todos</option>
              <option value="pendentes">Pendentes de Aprovação</option>
              <option value="aprovados">Aprovados</option>
            </select>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (showForm) {
                  resetForm();
                } else {
                  setShowForm(true);
                }
              }} 
              style={{ whiteSpace: 'nowrap' }}
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
          <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
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
              <label>
                <input
                  type="checkbox"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                />
                {' '}Ativo
              </label>
            </div>
            {formData.role === 'usuario' && (
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.aprovado}
                    onChange={(e) => setFormData({ ...formData, aprovado: e.target.checked })}
                  />
                  {' '}Aprovado
                </label>
              </div>
            )}
            
            {formData.role === 'usuario' && (
              <div className="form-group">
                <label>Igrejas (selecione as igrejas que este usuário pode gerenciar)</label>
                <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {igrejas.map(igreja => (
                    <label key={igreja.id} style={{ display: 'block', marginBottom: '8px' }}>
                      <input
                        type="checkbox"
                        checked={formData.igreja_ids.includes(igreja.id)}
                        onChange={() => toggleIgreja(igreja.id)}
                      />
                      {' '}{igreja.nome}
                    </label>
                  ))}
                  {igrejas.length === 0 && (
                    <p style={{ color: '#999', fontStyle: 'italic' }}>Nenhuma igreja cadastrada</p>
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
                    <tr key={usuario.id} style={usuario.aprovado === 0 ? { backgroundColor: '#fff3cd' } : {}}>
                      <td data-label="Nome" style={{ wordBreak: 'break-word' }}>{usuario.nome}</td>
                      <td data-label="Email" style={{ wordBreak: 'break-word' }}>{usuario.email}</td>
                      <td data-label="Perfil">{usuario.role === 'admin' ? 'Administrador' : 'Usuário'}</td>
                      <td data-label="Igrejas" style={{ wordBreak: 'break-word', maxWidth: '200px' }}>{usuario.igrejas_nomes || '-'}</td>
                      <td data-label="Status">
                        {usuario.role === 'admin' ? (
                          <span style={{ color: '#28a745', fontWeight: '600' }}>Aprovado</span>
                        ) : usuario.aprovado === 1 ? (
                          <span style={{ color: '#28a745', fontWeight: '600' }}>✓ Aprovado</span>
                        ) : (
                          <span style={{ color: '#dc3545', fontWeight: '600' }}>⏳ Pendente</span>
                        )}
                      </td>
                      <td data-label="Ativo">{usuario.ativo === 1 ? 'Sim' : 'Não'}</td>
                      <td>
                        <div className="actions" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {usuario.role !== 'admin' && usuario.aprovado === 0 && (
                            <>
                              <button
                                className="btn"
                                onClick={() => handleAprovar(usuario.id)}
                                style={{ 
                                  fontSize: '12px', 
                                  padding: '5px 10px',
                                  backgroundColor: '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  minWidth: '80px'
                                }}
                              >
                                ✓ Aprovar
                              </button>
                              <button
                                className="btn"
                                onClick={() => handleRejeitar(usuario.id)}
                                style={{ 
                                  fontSize: '12px', 
                                  padding: '5px 10px',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  minWidth: '80px'
                                }}
                              >
                                ✗ Rejeitar
                              </button>
                            </>
                          )}
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleEdit(usuario)}
                            style={{ fontSize: '12px', padding: '5px 10px', minWidth: '70px' }}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleDelete(usuario.id)}
                            style={{ fontSize: '12px', padding: '5px 10px', minWidth: '70px' }}
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
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '15px',
            boxSizing: 'border-box',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
            <div className="card" style={{ 
              maxWidth: '600px', 
              width: '100%',
              maxHeight: '90vh', 
              overflow: 'auto',
              margin: 'auto',
              position: 'relative'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <h2 style={{ 
                  fontSize: 'clamp(1.1rem, 4vw, 1.5rem)',
                  margin: 0,
                  flex: '1 1 auto',
                  minWidth: '200px'
                }}>
                  Editar Usuário
                </h2>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleCloseEditModal}
                  style={{ 
                    minWidth: '80px',
                    flexShrink: 0
                  }}
                >
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
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    />
                    {' '}Ativo
                  </label>
                </div>
                {formData.role === 'usuario' && (
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.aprovado}
                        onChange={(e) => setFormData({ ...formData, aprovado: e.target.checked })}
                      />
                      {' '}Aprovado
                    </label>
                  </div>
                )}
                
                {formData.role === 'usuario' && (
                  <div className="form-group">
                    <label>Igrejas (selecione as igrejas que este usuário pode gerenciar)</label>
                    <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                      {igrejas.map(igreja => (
                        <label key={igreja.id} style={{ display: 'block', marginBottom: '8px' }}>
                          <input
                            type="checkbox"
                            checked={formData.igreja_ids.includes(igreja.id)}
                            onChange={() => toggleIgreja(igreja.id)}
                          />
                          {' '}{igreja.nome}
                        </label>
                      ))}
                      {igrejas.length === 0 && (
                        <p style={{ color: '#999', fontStyle: 'italic' }}>Nenhuma igreja cadastrada</p>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
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
