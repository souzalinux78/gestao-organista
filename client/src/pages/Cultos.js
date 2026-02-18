import React, { useState, useEffect } from 'react';
import { getCultos, createCulto, updateCulto, deleteCulto, getCultosIgreja } from '../services/api';
import { getIgrejas } from '../services/api';
import Modal from '../components/Modal';

function Cultos({ user }) {
  const [cultos, setCultos] = useState([]);
  const [igrejas, setIgrejas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    igreja_id: '',
    dia_semana: '',
    hora: '',
    ativo: true,
    tipo: 'culto_oficial',
    tipo_recorrencia: 'semanal',
    ordem_mes: ''
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadCultos();
    loadIgrejas();
  }, []);

  useEffect(() => {
    // Se usuário comum tem apenas 1 igreja, selecionar automaticamente
    if (user?.role !== 'admin' && igrejas.length === 1) {
      setFormData(prev => ({ ...prev, igreja_id: igrejas[0].id.toString() }));
    }
  }, [igrejas, user]);

  // Reaplicar igreja quando o formulário for aberto para novo cadastro
  useEffect(() => {
    // Se o formulário está aberto para novo cadastro (não edição) e usuário não é admin
    if (showForm && !editing && user?.role !== 'admin' && igrejas.length === 1) {
      setFormData(prev => {
        // Só atualizar se o igreja_id estiver vazio
        if (!prev.igreja_id) {
          return { ...prev, igreja_id: igrejas[0].id.toString() };
        }
        return prev;
      });
    }
  }, [showForm, editing, user, igrejas.length]);

  const loadCultos = async () => {
    try {
      const response = await getCultos();
      setCultos(response.data);
    } catch (error) {
      showAlert('Erro ao carregar cultos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadIgrejas = async () => {
    try {
      const response = await getIgrejas();
      setIgrejas(response.data);
    } catch (error) {
      console.error('Erro ao carregar igrejas:', error);
    }
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validação: garantir que igreja_id está preenchido
    if (!formData.igreja_id) {
      showAlert('Por favor, selecione uma igreja', 'error');
      return;
    }

    try {
      if (editing) {
        await updateCulto(editing.id, formData);
        showAlert('Culto atualizado com sucesso!');
      } else {
        await createCulto(formData);
        showAlert('Culto cadastrado com sucesso!');
      }
      resetForm();
      loadCultos();
    } catch (error) {
      showAlert('Erro ao salvar culto', 'error');
    }
  };

  const openEditModal = (culto) => {
    setEditing(culto);
    setFormData({
      igreja_id: culto.igreja_id,
      dia_semana: culto.dia_semana,
      hora: culto.hora,
      ativo: culto.ativo === 1,
      tipo: culto.tipo || 'culto_oficial',
      tipo_recorrencia: culto.tipo_recorrencia || 'semanal',
      ordem_mes: culto.ordem_mes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar este culto?')) {
      try {
        await deleteCulto(id);
        showAlert('Culto deletado com sucesso!');
        loadCultos();
      } catch (error) {
        showAlert('Erro ao deletar culto', 'error');
      }
    }
  };

  const resetForm = () => {
    // Preservar igreja_id para usuários não-admin (que têm apenas 1 igreja)
    const preservedIgrejaId = (user?.role !== 'admin' && igrejas.length === 1)
      ? igrejas[0].id.toString()
      : '';

    setFormData({
      igreja_id: preservedIgrejaId,
      dia_semana: '',
      hora: '',
      ativo: true,
      tipo: 'culto_oficial',
      tipo_recorrencia: 'semanal',
      ordem_mes: ''
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

  const diasSemana = [
    { value: 'segunda', label: 'Segunda-feira' },
    { value: 'terça', label: 'Terça-feira' },
    { value: 'quarta', label: 'Quarta-feira' },
    { value: 'quinta', label: 'Quinta-feira' },
    { value: 'sexta', label: 'Sexta-feira' },
    { value: 'sábado', label: 'Sábado' },
    { value: 'domingo', label: 'Domingo' }
  ];

  return (
    <div>
      <div className="card">
        <div className="page-header">
          <h2>Cultos (v2.0)</h2>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!showForm) {
                // Ao abrir o formulário, garantir que a igreja está selecionada para usuários não-admin
                if (user?.role !== 'admin' && igrejas.length === 1) {
                  setFormData(prev => ({
                    ...prev,
                    igreja_id: prev.igreja_id || igrejas[0].id.toString(),
                    dia_semana: '',
                    hora: '',
                    ativo: true
                  }));
                } else {
                  setFormData(prev => ({
                    ...prev,
                    dia_semana: '',
                    hora: '',
                    ativo: true
                  }));
                }
              }
              setShowForm(!showForm);
            }}
          >
            {showForm ? 'Cancelar' : '+ Novo Culto'}
          </button>
        </div>

        {alert && (
          <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
            {alert.message}
          </div>
        )}

        {showForm && !editing && (
          <form onSubmit={handleSubmit} className="form--spaced">
            {user?.role === 'admin' ? (
              <div className="form-group">
                <label>Igreja *</label>
                <select
                  value={formData.igreja_id}
                  onChange={(e) => setFormData({ ...formData, igreja_id: e.target.value })}
                  required
                >
                  <option value="">Selecione uma igreja...</option>
                  {igrejas.map(igreja => (
                    <option key={igreja.id} value={igreja.id}>
                      {igreja.nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Igreja</label>
                <input
                  type="text"
                  value={igrejas.find(i => i.id.toString() === formData.igreja_id)?.nome || ''}
                  disabled
                  className="input-readonly"
                />
              </div>
            )}
            <div className="form-group">
              <label>Dia da Semana *</label>
              <select
                value={formData.dia_semana}
                onChange={(e) => setFormData({ ...formData, dia_semana: e.target.value })}
                required
              >
                <option value="">Selecione o dia...</option>
                {diasSemana.map(dia => (
                  <option key={dia.value} value={dia.value}>
                    {dia.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Hora *</label>
              <input
                type="time"
                value={formData.hora}
                onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Tipo *</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                required
              >
                <option value="culto_oficial">Culto Oficial</option>
                <option value="rjm">RJM</option>
                <option value="outro">Outro (Extra)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Recorrência *</label>
              <div className="form-group">
                <label>Recorrência *</label>
                <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: 'normal',
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: formData.tipo_recorrencia === 'semanal' ? '#fff9db' : '#fff',
                    borderColor: formData.tipo_recorrencia === 'semanal' ? '#daa520' : '#ccc',
                    whiteSpace: 'nowrap'
                  }}>
                    <input
                      type="radio"
                      name="recorrencia_new"
                      value="semanal"
                      checked={formData.tipo_recorrencia === 'semanal'}
                      onChange={() => setFormData({ ...formData, tipo_recorrencia: 'semanal', ordem_mes: '' })}
                      style={{ margin: 0, accentColor: '#daa520' }}
                    />
                    <span style={{ fontSize: '14px' }}>Toda semana</span>
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: 'normal',
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: formData.tipo_recorrencia === 'mensal' ? '#fff9db' : '#fff',
                    borderColor: formData.tipo_recorrencia === 'mensal' ? '#daa520' : '#ccc',
                    whiteSpace: 'nowrap'
                  }}>
                    <input
                      type="radio"
                      name="recorrencia_new"
                      value="mensal"
                      checked={formData.tipo_recorrencia === 'mensal'}
                      onChange={() => setFormData({ ...formData, tipo_recorrencia: 'mensal', ordem_mes: '1' })}
                      style={{ margin: 0, accentColor: '#daa520' }}
                    />
                    <span style={{ fontSize: '14px' }}>Mensal</span>
                  </label>
                </div>
              </div>
            </div>

            {formData.tipo_recorrencia === 'mensal' && (
              <div className="form-group" style={{
                marginTop: '15px',
                padding: '15px',
                background: '#fff3cd',
                border: '1px solid #ffeeba',
                borderRadius: '4px'
              }}>
                <label style={{ color: '#856404', fontWeight: 'bold' }}>Em qual semana do mês? *</label>
                <select
                  value={formData.ordem_mes}
                  onChange={(e) => setFormData({ ...formData, ordem_mes: e.target.value })}
                  required
                  style={{ marginTop: '5px' }}
                >
                  <option value="1">Primeira semana</option>
                  <option value="2">Segunda semana</option>
                  <option value="3">Terceira semana</option>
                  <option value="4">Quarta semana</option>
                  <option value="5">Quinta semana</option>
                </select>
                <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                  O culto ocorrerá apenas nesta semana específica de cada mês.
                </small>
              </div>
            )}

            <div className="form-group">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="checkbox-input"
                />
                <span className="checkbox-label-text">Ativo</span>
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              {editing ? 'Atualizar' : 'Salvar'}
            </button>
          </form>
        )}

        <Modal isOpen={showForm && editing} title="Editar Culto" onClose={closeEditModal}>
          <form onSubmit={handleSubmit} className="form--spaced">
            {user?.role === 'admin' ? (
              <div className="form-group">
                <label>Igreja *</label>
                <select
                  value={formData.igreja_id}
                  onChange={(e) => setFormData({ ...formData, igreja_id: e.target.value })}
                  required
                >
                  <option value="">Selecione uma igreja...</option>
                  {igrejas.map(igreja => (
                    <option key={igreja.id} value={igreja.id}>
                      {igreja.nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Igreja</label>
                <input
                  type="text"
                  value={igrejas.find(i => i.id.toString() === formData.igreja_id)?.nome || ''}
                  disabled
                  className="input-readonly"
                />
              </div>
            )}
            <div className="form-group">
              <label>Dia da Semana *</label>
              <select
                value={formData.dia_semana}
                onChange={(e) => setFormData({ ...formData, dia_semana: e.target.value })}
                required
              >
                <option value="">Selecione o dia...</option>
                {diasSemana.map(dia => (
                  <option key={dia.value} value={dia.value}>
                    {dia.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Hora *</label>
              <input
                type="time"
                value={formData.hora}
                onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Tipo *</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                required
              >
                <option value="culto_oficial">Culto Oficial</option>
                <option value="rjm">RJM</option>
                <option value="outro">Outro (Extra)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Recorrência *</label>
              <div className="form-group">
                <label>Recorrência *</label>
                <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: 'normal',
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: formData.tipo_recorrencia === 'semanal' ? '#fff9db' : '#fff',
                    borderColor: formData.tipo_recorrencia === 'semanal' ? '#daa520' : '#ccc',
                    whiteSpace: 'nowrap'
                  }}>
                    <input
                      type="radio"
                      name="recorrencia"
                      value="semanal"
                      checked={formData.tipo_recorrencia === 'semanal'}
                      onChange={() => setFormData({ ...formData, tipo_recorrencia: 'semanal', ordem_mes: '' })}
                      style={{ margin: 0, accentColor: '#daa520' }}
                    />
                    <span style={{ fontSize: '14px' }}>Toda semana</span>
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: 'normal',
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: formData.tipo_recorrencia === 'mensal' ? '#fff9db' : '#fff',
                    borderColor: formData.tipo_recorrencia === 'mensal' ? '#daa520' : '#ccc',
                    whiteSpace: 'nowrap'
                  }}>
                    <input
                      type="radio"
                      name="recorrencia"
                      value="mensal"
                      checked={formData.tipo_recorrencia === 'mensal'}
                      onChange={() => setFormData({ ...formData, tipo_recorrencia: 'mensal', ordem_mes: '1' })}
                      style={{ margin: 0, accentColor: '#daa520' }}
                    />
                    <span style={{ fontSize: '14px' }}>Mensal</span>
                  </label>
                </div>
              </div>
            </div>

            {formData.tipo_recorrencia === 'mensal' && (
              <div className="form-group" style={{
                marginTop: '15px',
                padding: '15px',
                background: '#fff3cd',
                border: '1px solid #ffeeba',
                borderRadius: '4px'
              }}>
                <label style={{ color: '#856404', fontWeight: 'bold' }}>Em qual semana do mês? *</label>
                <select
                  value={formData.ordem_mes}
                  onChange={(e) => setFormData({ ...formData, ordem_mes: e.target.value })}
                  required
                  style={{ marginTop: '5px' }}
                >
                  <option value="1">Primeira semana</option>
                  <option value="2">Segunda semana</option>
                  <option value="3">Terceira semana</option>
                  <option value="4">Quarta semana</option>
                  <option value="5">Quinta semana</option>
                </select>
                <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                  O culto ocorrerá apenas nesta semana específica de cada mês.
                </small>
              </div>
            )}

            <div className="form-group">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  id="edit_ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="checkbox-input"
                />
                <span className="checkbox-label-text">Ativo</span>
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              Atualizar
            </button>
          </form>
        </Modal>

        {cultos.length === 0 ? (
          <div className="empty">Nenhum culto cadastrado</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Igreja</th>
                  <th>Dia da Semana</th>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Ativo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cultos.map(culto => (
                  <tr key={culto.id}>
                    <td data-label="Igreja" className="td-wrap">{culto.igreja_nome}</td>
                    <td data-label="Dia da Semana">{culto.dia_semana}</td>
                    <td data-label="Hora">{culto.hora ? culto.hora.substring(0, 5) : '-'}</td>
                    <td data-label="Tipo">
                      {culto.tipo === 'rjm' ? 'RJM' : (culto.tipo === 'outro' ? 'Outro' : 'Oficial')}
                      {culto.tipo_recorrencia === 'mensal' && (
                        <div style={{ fontSize: '0.8em', color: '#666' }}>
                          Mensal ({culto.ordem_mes}ª)
                        </div>
                      )}
                    </td>
                    <td data-label="Ativo">{culto.ativo === 1 ? 'Sim' : 'Não'}</td>
                    <td data-label="Ações">
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={(event) => {
                            event.preventDefault();
                            openEditModal(culto);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(culto.id)}
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

export default Cultos;
