import React, { useState, useEffect } from 'react';
import { getIgrejas, createIgreja, updateIgreja, deleteIgreja, getOrganistasIgreja, addOrganistaIgreja, removeOrganistaIgreja } from '../services/api';
import { getOrganistas } from '../services/api';

function Igrejas({ user }) {
  const [igrejas, setIgrejas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    endereco: '',
    encarregado_local_nome: '',
    encarregado_local_telefone: '',
    encarregado_regional_nome: '',
    encarregado_regional_telefone: ''
  });
  const [alert, setAlert] = useState(null);
  const [selectedIgreja, setSelectedIgreja] = useState(null);
  const [organistasIgreja, setOrganistasIgreja] = useState([]);
  const [allOrganistas, setAllOrganistas] = useState([]);
  const [showOrganistasModal, setShowOrganistasModal] = useState(false);

  useEffect(() => {
    loadIgrejas();
    loadAllOrganistas();
  }, []);

  const loadIgrejas = async () => {
    try {
      const response = await getIgrejas();
      setIgrejas(response.data);
    } catch (error) {
      showAlert('Erro ao carregar igrejas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAllOrganistas = async () => {
    try {
      const response = await getOrganistas();
      // Filtrar apenas organistas oficializadas e ativas
      setAllOrganistas(response.data.filter(o => o.oficializada === 1 && o.ativa === 1));
    } catch (error) {
      console.error('Erro ao carregar organistas:', error);
    }
  };

  const loadOrganistasIgreja = async (igrejaId) => {
    try {
      const response = await getOrganistasIgreja(igrejaId);
      console.log('[DEBUG] Organistas carregadas da igreja:', response.data);
      setOrganistasIgreja(response.data);
      
      // Não mostrar alerta aqui, apenas log
      if (response.data.length === 0) {
        console.log('[DEBUG] Nenhuma organista associada à igreja', igrejaId);
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao carregar organistas:', error);
      showAlert('Erro ao carregar organistas da igreja: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateIgreja(editing.id, formData);
        showAlert('Igreja atualizada com sucesso!');
      } else {
        await createIgreja(formData);
        showAlert('Igreja cadastrada com sucesso!');
      }
      resetForm();
      loadIgrejas();
    } catch (error) {
      showAlert('Erro ao salvar igreja', 'error');
    }
  };

  const handleEdit = (igreja) => {
    setEditing(igreja);
    setFormData({
      nome: igreja.nome,
      endereco: igreja.endereco || '',
      encarregado_local_nome: igreja.encarregado_local_nome || '',
      encarregado_local_telefone: igreja.encarregado_local_telefone || '',
      encarregado_regional_nome: igreja.encarregado_regional_nome || '',
      encarregado_regional_telefone: igreja.encarregado_regional_telefone || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar esta igreja?')) {
      try {
        await deleteIgreja(id);
        showAlert('Igreja deletada com sucesso!');
        loadIgrejas();
      } catch (error) {
        showAlert('Erro ao deletar igreja', 'error');
      }
    }
  };

  const handleManageOrganistas = async (igreja) => {
    setSelectedIgreja(igreja);
    await loadAllOrganistas(); // Recarregar organistas disponíveis
    await loadOrganistasIgreja(igreja.id);
    setShowOrganistasModal(true);
  };

  const handleAddOrganista = async (organistaId) => {
    try {
      console.log('[DEBUG] Adicionando organista', organistaId, 'à igreja', selectedIgreja.id);
      const response = await addOrganistaIgreja(selectedIgreja.id, organistaId);
      console.log('[DEBUG] Resposta:', response.data);
      showAlert(response.data?.message || 'Organista adicionada à igreja com sucesso!');
      await loadOrganistasIgreja(selectedIgreja.id);
      await loadAllOrganistas(); // Recarregar lista de organistas disponíveis
    } catch (error) {
      console.error('[DEBUG] Erro ao adicionar organista:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao adicionar organista';
      showAlert(errorMessage, 'error');
    }
  };

  const handleRemoveOrganista = async (organistaId) => {
    if (window.confirm('Remover organista desta igreja?')) {
      try {
        await removeOrganistaIgreja(selectedIgreja.id, organistaId);
        showAlert('Organista removida da igreja!');
        loadOrganistasIgreja(selectedIgreja.id);
      } catch (error) {
        showAlert('Erro ao remover organista', 'error');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      endereco: '',
      encarregado_local_nome: '',
      encarregado_local_telefone: '',
      encarregado_regional_nome: '',
      encarregado_regional_telefone: ''
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2>Igrejas</h2>
          {user?.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancelar' : '+ Nova Igreja'}
            </button>
          )}
        </div>

        {alert && (
          <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
            {alert.message}
          </div>
        )}

        {showForm && (
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
              <label>Endereço</label>
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              />
            </div>
            <h3 style={{ marginTop: '20px', marginBottom: '15px' }}>Encarregado Local</h3>
            <div className="form-group">
              <label>Nome</label>
              <input
                type="text"
                value={formData.encarregado_local_nome}
                onChange={(e) => setFormData({ ...formData, encarregado_local_nome: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Telefone</label>
              <input
                type="text"
                value={formData.encarregado_local_telefone}
                onChange={(e) => setFormData({ ...formData, encarregado_local_telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <h3 style={{ marginTop: '20px', marginBottom: '15px' }}>Encarregado Regional</h3>
            <div className="form-group">
              <label>Nome</label>
              <input
                type="text"
                value={formData.encarregado_regional_nome}
                onChange={(e) => setFormData({ ...formData, encarregado_regional_nome: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Telefone</label>
              <input
                type="text"
                value={formData.encarregado_regional_telefone}
                onChange={(e) => setFormData({ ...formData, encarregado_regional_telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              {editing ? 'Atualizar' : 'Salvar'}
            </button>
          </form>
        )}

        {igrejas.length === 0 ? (
          <div className="empty">Nenhuma igreja cadastrada</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Endereço</th>
                  <th>Encarregado Local</th>
                  <th>Encarregado Regional</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {igrejas.map(igreja => (
                  <tr key={igreja.id}>
                    <td style={{ fontWeight: '600' }}>{igreja.nome}</td>
                    <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>{igreja.endereco || '-'}</td>
                    <td>{igreja.encarregado_local_nome || '-'}</td>
                    <td>{igreja.encarregado_regional_nome || '-'}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleEdit(igreja)}
                          style={{ fontSize: '12px', padding: '5px 10px', minWidth: '70px' }}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-success"
                          onClick={() => handleManageOrganistas(igreja)}
                          style={{ fontSize: '12px', padding: '5px 10px', minWidth: '90px' }}
                        >
                          Organistas
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            className="btn btn-danger"
                            onClick={() => handleDelete(igreja.id)}
                            style={{ fontSize: '12px', padding: '5px 10px', minWidth: '70px' }}
                          >
                            Deletar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showOrganistasModal && selectedIgreja && (
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
          overflow: 'auto'
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
                Organistas Oficializadas - {selectedIgreja.nome}
              </h2>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowOrganistasModal(false)}
                style={{ 
                  minWidth: '80px',
                  flexShrink: 0
                }}
              >
                Fechar
              </button>
            </div>
            
            <h3 style={{ 
              marginBottom: '15px',
              fontSize: 'clamp(1rem, 3.5vw, 1.2rem)'
            }}>Adicionar Organista</h3>
            {allOrganistas.filter(o => !organistasIgreja.find(oi => oi.id === o.id)).length === 0 ? (
              <div style={{ 
                padding: '15px', 
                background: '#fff3cd', 
                border: '1px solid #ffc107', 
                borderRadius: '4px', 
                marginBottom: '20px',
                fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)'
              }}>
                <strong>⚠️ Nenhuma organista disponível</strong>
                <p style={{ 
                  margin: '5px 0 0 0', 
                  fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)',
                  lineHeight: '1.5'
                }}>
                  Todas as organistas oficializadas já estão associadas a esta igreja, ou não há organistas marcadas como "Oficializada" e "Ativa".
                  <br />
                  Vá em "Organistas" e verifique se há organistas marcadas como oficializadas.
                </p>
              </div>
            ) : (
              <div>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddOrganista(parseInt(e.target.value));
                      e.target.value = '';
                    }
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    marginBottom: '10px',
                    fontSize: '16px',
                    borderRadius: '8px',
                    border: '2px solid var(--gray-medium)',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Selecione uma organista oficializada...</option>
                  {allOrganistas
                    .filter(o => !organistasIgreja.find(oi => oi.id === o.id))
                    .map(organista => (
                      <option key={organista.id} value={organista.id}>
                        {organista.nome} {organista.telefone ? `(${organista.telefone})` : ''}
                      </option>
                    ))}
                </select>
                {allOrganistas.filter(o => !organistasIgreja.find(oi => oi.id === o.id)).length > 0 ? (
                  <p style={{ 
                    fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)', 
                    color: '#28a745', 
                    margin: '5px 0', 
                    fontWeight: '600' 
                  }}>
                    ✅ {allOrganistas.filter(o => !organistasIgreja.find(oi => oi.id === o.id)).length} organista(s) disponível(is) para adicionar
                  </p>
                ) : allOrganistas.length > 0 ? (
                  <p style={{ 
                    fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)', 
                    color: '#ffc107', 
                    margin: '5px 0', 
                    fontWeight: '600' 
                  }}>
                    ⚠️ Todas as organistas oficializadas já estão associadas a esta igreja
                  </p>
                ) : (
                  <p style={{ 
                    fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)', 
                    color: '#dc3545', 
                    margin: '5px 0', 
                    fontWeight: '600' 
                  }}>
                    ❌ Nenhuma organista oficializada e ativa cadastrada no sistema
                  </p>
                )}
              </div>
            )}

            <h3 style={{ 
              marginBottom: '15px',
              fontSize: 'clamp(1rem, 3.5vw, 1.2rem)'
            }}>Organistas da Igreja ({organistasIgreja.length})</h3>
            {organistasIgreja.length === 0 ? (
              <div style={{ 
                padding: '15px', 
                background: '#fff3cd', 
                border: '1px solid #ffc107', 
                borderRadius: '4px', 
                marginBottom: '20px',
                fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)'
              }}>
                <strong>⚠️ Nenhuma organista oficializada associada a esta igreja</strong>
                <p style={{ margin: '10px 0 0 0', fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)', lineHeight: '1.6' }}>
                  <strong>Para gerar rodízios, você precisa adicionar organistas acima.</strong>
                  <br />
                  Se não aparecer nenhuma organista no dropdown, verifique:
                  <br />
                  • Se há organistas marcadas como <strong>"Oficializada"</strong> e <strong>"Ativa"</strong> na página de Organistas
                  <br />
                  • Se as organistas já não estão associadas a esta igreja (verifique a lista abaixo)
                </p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Telefone</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {organistasIgreja.map(organista => (
                      <tr key={organista.id}>
                        <td style={{ fontWeight: '500' }}>{organista.nome}</td>
                        <td>{organista.telefone || '-'}</td>
                        <td>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleRemoveOrganista(organista.id)}
                            style={{ 
                              fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', 
                              padding: '8px 12px',
                              minWidth: '80px'
                            }}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Igrejas;
