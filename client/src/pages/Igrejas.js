import React, { useState, useEffect, useCallback } from 'react';
import { getIgrejas, createIgreja, updateIgreja, deleteIgreja, getOrganistasIgreja, addOrganistaIgreja, removeOrganistaIgreja } from '../services/api';
import { getOrganistas } from '../services/api';
import Modal from '../components/Modal';

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
    encarregado_regional_telefone: '',
    mesma_organista_ambas_funcoes: false
  });
  const [alert, setAlert] = useState(null);
  const [selectedIgreja, setSelectedIgreja] = useState(null);
  const [organistasIgreja, setOrganistasIgreja] = useState([]);
  const [allOrganistas, setAllOrganistas] = useState([]);
  const [showOrganistasModal, setShowOrganistasModal] = useState(false);

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  }, []);

  const loadIgrejas = useCallback(async () => {
    try {
      const response = await getIgrejas();
      setIgrejas(response.data);
    } catch (error) {
      showAlert('Erro ao carregar igrejas', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  const loadAllOrganistas = useCallback(async () => {
    try {
      const response = await getOrganistas();
      // CORREÇÃO: Remover filtro de oficializada - listar TODAS as organistas ativas
      // Organistas não oficializadas e de meia hora também devem aparecer
      setAllOrganistas(response.data.filter(o => o.ativa === 1));
    } catch (error) {
      console.error('Erro ao carregar organistas:', error);
    }
  }, []);

  useEffect(() => {
    loadIgrejas();
    loadAllOrganistas();
  }, [loadIgrejas, loadAllOrganistas]);

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

  const openEditModal = (igreja) => {
    setEditing(igreja);
    setFormData({
      nome: igreja.nome,
      endereco: igreja.endereco || '',
      encarregado_local_nome: igreja.encarregado_local_nome || '',
      encarregado_local_telefone: igreja.encarregado_local_telefone || '',
      encarregado_regional_nome: igreja.encarregado_regional_nome || '',
      encarregado_regional_telefone: igreja.encarregado_regional_telefone || '',
      mesma_organista_ambas_funcoes: igreja.mesma_organista_ambas_funcoes === 1 || igreja.mesma_organista_ambas_funcoes === true
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
      encarregado_regional_telefone: '',
      mesma_organista_ambas_funcoes: false
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
          <h2>Igrejas</h2>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : (user?.role === 'admin' ? '+ Nova Igreja' : '+ Cadastrar minha igreja')}
          </button>
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
              <label>Endereço</label>
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              />
            </div>
            <h3 className="form-section-title">Encarregado Local</h3>
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
            <h3 className="form-section-title">Encarregado Regional</h3>
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
            <div className="form-group">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  id="mesma_organista_ambas_funcoes"
                  checked={formData.mesma_organista_ambas_funcoes}
                  onChange={(e) => setFormData({ ...formData, mesma_organista_ambas_funcoes: e.target.checked })}
                  className="checkbox-input"
                />
                <span className="checkbox-label-text">
                  Permitir que a mesma organista faça meia hora e tocar no culto
                </span>
              </label>
              <p className="form-hint">
                Se marcado, no rodízio a mesma organista fará ambas as funções. Se não marcado, uma organista fará meia hora e outra tocará no culto.
              </p>
            </div>
            <button type="submit" className="btn btn-primary">
              {editing ? 'Atualizar' : 'Salvar'}
            </button>
          </form>
        )}

        <Modal isOpen={showForm && editing} title="Editar Igreja" onClose={closeEditModal}>
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
              <label>Endereço</label>
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              />
            </div>
            <h3 className="form-section-title">Encarregado Local</h3>
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
            <h3 className="form-section-title">Encarregado Regional</h3>
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
            <div className="form-group">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  id="edit_mesma_organista_ambas_funcoes"
                  checked={formData.mesma_organista_ambas_funcoes}
                  onChange={(e) => setFormData({ ...formData, mesma_organista_ambas_funcoes: e.target.checked })}
                  className="checkbox-input"
                />
                <span className="checkbox-label-text">
                  Permitir que a mesma organista faça meia hora e tocar no culto
                </span>
              </label>
              <p className="form-hint">
                Se marcado, no rodízio a mesma organista fará ambas as funções. Se não marcado, uma organista fará meia hora e outra tocará no culto.
              </p>
            </div>
            <button type="submit" className="btn btn-primary">
              Atualizar
            </button>
          </form>
        </Modal>

        {igrejas.length === 0 ? (
          <div className="empty">
            <div className="empty__title">Nenhuma igreja cadastrada</div>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              {user?.role === 'admin' ? '+ Nova Igreja' : '+ Cadastrar minha igreja'}
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Endereço</th>
                  <th>Encarregado Local</th>
                  <th>Encarregado Regional</th>
                  {user?.role === 'admin' && (
                    <>
                      <th className="th-center">Organistas</th>
                      <th className="th-center">Usuários</th>
                      <th className="th-center">Cultos</th>
                    </>
                  )}
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {igrejas.map(igreja => (
                  <tr key={igreja.id}>
                    <td data-label="Nome" className="td-strong">{igreja.nome}</td>
                    <td data-label="Endereço" className="td-wrap">{igreja.endereco || '-'}</td>
                    <td data-label="Encarregado Local">{igreja.encarregado_local_nome || '-'}</td>
                    <td data-label="Encarregado Regional">{igreja.encarregado_regional_nome || '-'}</td>
                    {user?.role === 'admin' && (
                      <>
                        <td data-label="Organistas" className="td-center">
                          <span className={`stat-pill ${igreja.total_organistas > 0 ? 'stat-pill--ok' : 'stat-pill--warn'}`}>
                            {igreja.total_organistas || 0}
                          </span>
                        </td>
                        <td data-label="Usuários" className="td-center">
                          <span className={`stat-pill ${igreja.total_usuarios > 0 ? 'stat-pill--ok' : 'stat-pill--warn'}`}>
                            {igreja.total_usuarios || 0}
                          </span>
                        </td>
                        <td data-label="Cultos" className="td-center">
                          <span className={`stat-pill ${igreja.total_cultos > 0 ? 'stat-pill--ok' : 'stat-pill--warn'}`}>
                            {igreja.total_cultos || 0}
                          </span>
                        </td>
                      </>
                    )}
                    <td data-label="Ações">
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={(event) => {
                            event.preventDefault();
                            openEditModal(igreja);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-success"
                          onClick={() => handleManageOrganistas(igreja)}
                        >
                          Organistas
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            className="btn btn-danger"
                            onClick={() => handleDelete(igreja.id)}
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
        <div className="modal-overlay">
          <div className="card modal-panel">
            <div className="modal-header">
              <h2 className="modal-title">Organistas Oficializadas - {selectedIgreja.nome}</h2>
              <button className="btn btn-secondary btn-nowrap" onClick={() => setShowOrganistasModal(false)}>
                Fechar
              </button>
            </div>
            
            <h3 className="form-section-title">Adicionar Organista</h3>
            {allOrganistas.filter(o => !organistasIgreja.find(oi => oi.id === o.id)).length === 0 ? (
              <div className="callout">
                <strong className="callout__title">⚠️ Nenhuma organista disponível</strong>
                <p className="form-hint form-hint--spaced">
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
                  <p className="form-hint form-hint--success">
                    ✅ {allOrganistas.filter(o => !organistasIgreja.find(oi => oi.id === o.id)).length} organista(s) disponível(is) para adicionar
                  </p>
                ) : allOrganistas.length > 0 ? (
                  <p className="form-hint form-hint--warn">
                    ⚠️ Todas as organistas oficializadas já estão associadas a esta igreja
                  </p>
                ) : (
                  <p className="form-hint form-hint--danger">
                    ❌ Nenhuma organista oficializada e ativa cadastrada no sistema
                  </p>
                )}
              </div>
            )}

            <h3 className="form-section-title">Organistas da Igreja ({organistasIgreja.length})</h3>
            {organistasIgreja.length === 0 ? (
              <div className="callout">
                <strong className="callout__title">⚠️ Nenhuma organista oficializada associada a esta igreja</strong>
                <p className="form-hint form-hint--spaced">
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
                        <td className="td-strong">{organista.nome}</td>
                        <td>{organista.telefone || '-'}</td>
                        <td>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleRemoveOrganista(organista.id)}
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

