// ... imports
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// --- ESTILOS VISUAIS ---
const styles = {
  container: { padding: '20px', backgroundColor: 'var(--bg-main)', minHeight: '100vh', fontFamily: "Manrope, Inter, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
  header: { marginBottom: '25px', backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '20px', boxShadow: '0 10px 24px rgba(16,24,40,0.06)', border: '1px solid var(--border)' },
  label: { display: 'block', marginBottom: '8px', fontWeight: '700', color: 'var(--text-main)' },
  select: { padding: '10px', fontSize: '16px', borderRadius: '14px', border: '1px solid var(--border)', width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' },

  // Grid ajustado (Wrap)
  grid: { display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' },

  card: {
    background: 'var(--bg-card)', borderRadius: '20px', padding: '20px',
    width: '350px',
    border: '1px solid var(--border)', boxShadow: '0 10px 24px rgba(16,24,40,0.06)',
    display: 'flex', flexDirection: 'column',
    position: 'relative'
  },
  cardHeader: { marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cycleTitle: { margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)' },
  cycleSubtitle: { margin: 0, fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' },

  // NEW: Cultos Assigned Display
  assignedCultos: { marginTop: '5px', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '5px' },
  cultoTag: { display: 'inline-block', backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '6px', margin: '2px', fontSize: '11px', border: '1px solid var(--border)' },

  listContainer: { minHeight: '200px' },

  item: {
    padding: '10px 12px', marginBottom: '8px', backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
  },
  dragging: {
    backgroundColor: 'var(--primary-soft)',
    border: '1px solid var(--primary)',
    boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
  },

  rank: { fontWeight: 'bold', color: 'var(--text-muted)', width: '25px', fontSize: '14px' },
  name: { flex: 1, fontSize: '15px', color: 'var(--text-main)', fontWeight: '600' },

  badge: { fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: '600', textTransform: 'uppercase', marginLeft: '8px' },
  badgeOficial: { backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9' },
  badgeRJM: { backgroundColor: '#e3f2fd', color: '#1565c0', border: '1px solid #bbdefb' },
  badgeAluna: { backgroundColor: '#fff3e0', color: '#ef6c00', border: '1px solid #ffe0b2' },

  btnIcon: { background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--danger)', borderRadius: '6px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  cardFooter: { marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '15px' },
  btnAddMode: { background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center', padding: '10px' },

  addArea: { display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-hover)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' },
  addSelect: { padding: '8px', borderRadius: '10px', border: '1px solid var(--border)', width: '100%', backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)' },
  btnAddActions: { display: 'flex', gap: '5px' },
  btnAddConfirm: { padding: '8px', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', flex: 1, fontWeight: '700' },
  btnAddCancel: { padding: '8px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer', flex: 1, fontWeight: '600' },

  btnSave: { width: '100%', padding: '10px', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px', fontSize: '14px' },

  controls: { marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' },
  btnControl: { padding: '8px 15px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', color: 'var(--text-main)' },
  btnNewCycle: { padding: '10px 18px', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700' },

  cycleActions: { display: 'flex', gap: '5px' },
  btnAction: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-main)'
  },

  // Modal styles extra
  modalSection: { marginBottom: '15px' },
  checkboxGroup: { display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border)', padding: '10px', borderRadius: '10px', background: 'var(--bg-surface)' }
};

export default function Ciclos() {
  const [igrejas, setIgrejas] = useState([]);
  const [igrejaSelecionada, setIgrejaSelecionada] = useState('');
  const [todasOrganistas, setTodasOrganistas] = useState([]);
  const [todosCultos, setTodosCultos] = useState([]); // [NEW]

  // Estrutura: { cicloId: [itens...] }
  const [ciclosItens, setCiclosItens] = useState({});
  // Metadados dos Ciclos: [{ id: 1, nome: 'Cultos', ordem: 1 }, ...]
  const [metadadosCiclos, setMetadadosCiclos] = useState([]);

  const [loading, setLoading] = useState(true);

  // Estado para controlar Adicionar Organista
  const [adicionandoEmCiclo, setAdicionandoEmCiclo] = useState(null);
  const [organistaSelecionadaParaAdicionar, setOrganistaSelecionadaParaAdicionar] = useState('');

  // Estado para Criar/Editar Ciclo
  const [editingCycle, setEditingCycle] = useState(null); // null or { id?, nome, ordem, selectedCultos: [] }
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleName, setCycleName] = useState('');
  const [cycleOrder, setCycleOrder] = useState(1); // Estado para ordem
  const [selectedCultosIds, setSelectedCultosIds] = useState([]); // [NEW] IDs dos cultos selecionados no modal

  const getToken = () => localStorage.getItem('token');
  const api = axios.create({ baseURL: '/api', headers: { 'Authorization': `Bearer ${getToken()}` } });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregarIgrejas(); }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (igrejaSelecionada) {
      carregarDados();
    }
  }, [igrejaSelecionada]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregarIgrejas = async () => {
    try {
      const response = await api.get('/igrejas');
      const lista = response.data;
      setIgrejas(lista);
      if (lista.length > 0) setIgrejaSelecionada(lista[0].id);
      else setLoading(false);
    } catch (error) {
      console.error("Erro ao carregar igrejas:", error);
      setLoading(false);
    }
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      await Promise.all([
        carregarTodasOrganistas(),
        carregarTodosCultos(), // [NEW]
        carregarMetadadosCiclos(),
        carregarCiclosItens()
      ]);
    } catch (e) {
      console.error("Erro ao carregar dados", e);
    } finally {
      setLoading(false);
    }
  };

  const carregarTodasOrganistas = async () => {
    try {
      const response = await api.get(`/igrejas/${igrejaSelecionada}/organistas`);
      setTodasOrganistas(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar lista de organistas:", error);
    }
  };

  const carregarTodosCultos = async () => {
    try {
      const response = await api.get(`/cultos/igreja/${igrejaSelecionada}`);
      setTodosCultos(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar cultos:", error);
    }
  };

  const carregarMetadadosCiclos = async () => {
    try {
      const response = await api.get(`/ciclos/igreja/${igrejaSelecionada}`);
      setMetadadosCiclos(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar metadados ciclos", error);
    }
  };

  const carregarCiclosItens = async () => {
    try {
      const response = await api.get(`/igrejas/${igrejaSelecionada}/ciclos-organistas`);
      const dados = response.data;

      const organizados = {};

      // Inicializa arrays vazios para todos os ciclos conhecidos (sincronizar depois?)
      // Melhor processar o que veio e depois garantir que todos metadados tenham entrada

      dados.forEach((item, index) => {
        const cicloId = item.ciclo; // Now uses cycle ID
        if (!organizados[cicloId]) organizados[cicloId] = [];

        const orgId = item.organista_id || (item.organista && item.organista.id) || item.id;

        organizados[cicloId].push({
          ...item,
          uniqueId: `C${cicloId}-ORG${orgId}-IDX${index}`
        });
      });

      // Ordenar por 'ordem'
      Object.keys(organizados).forEach(key => {
        organizados[key].sort((a, b) => a.ordem - b.ordem);
      });

      setCiclosItens(organizados);
    } catch (error) {
      console.error("Erro ao carregar itens dos ciclos:", error);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const cicloOrigem = source.droppableId;
    const cicloDestino = destination.droppableId;

    const novosCiclos = { ...ciclosItens };

    // Garantir array existe
    if (!novosCiclos[cicloOrigem]) novosCiclos[cicloOrigem] = [];
    if (!novosCiclos[cicloDestino]) novosCiclos[cicloDestino] = [];

    const listaOrigem = [...novosCiclos[cicloOrigem]];
    const listaDestino = cicloOrigem === cicloDestino ? listaOrigem : [...novosCiclos[cicloDestino]];

    const [removido] = listaOrigem.splice(source.index, 1);
    listaDestino.splice(destination.index, 0, removido);

    novosCiclos[cicloOrigem] = listaOrigem;
    novosCiclos[cicloDestino] = listaDestino;
    setCiclosItens(novosCiclos);
  };

  const removerOrganista = (cicloId, index) => {
    if (!window.confirm("Remover esta organista do ciclo?")) return;
    const novosCiclos = { ...ciclosItens };
    novosCiclos[cicloId].splice(index, 1);
    setCiclosItens(novosCiclos);
  };

  const confirmarAdicao = (cicloId) => {
    if (!organistaSelecionadaParaAdicionar) return;

    const idBusca = String(organistaSelecionadaParaAdicionar);
    const organistaOriginal = todasOrganistas.find(o => String(o.id) === idBusca);

    if (!organistaOriginal) {
      alert("Erro: Organista nao encontrada na lista.");
      return;
    }

    const novosCiclos = { ...ciclosItens };
    if (!novosCiclos[cicloId]) novosCiclos[cicloId] = [];

    const novoItem = {
      organista_id: organistaOriginal.id,
      id: organistaOriginal.id,
      nome: organistaOriginal.nome,
      categoria: organistaOriginal.categoria,
      oficializada: organistaOriginal.oficializada,
      organista: { nome: organistaOriginal.nome, id: organistaOriginal.id, categoria: organistaOriginal.categoria },
      uniqueId: `C${cicloId}-NEW${organistaOriginal.id}-${Date.now()}`
    };

    novosCiclos[cicloId].push(novoItem);
    setCiclosItens(novosCiclos);

    setAdicionandoEmCiclo(null);
    setOrganistaSelecionadaParaAdicionar('');
  };

  const salvarCiclo = async (cicloId) => {
    if (!igrejaSelecionada) return;
    try {
      const itens = ciclosItens[cicloId] || [];
      const itensLimpos = itens.map((item, index) => {
        const idReal = item.organista_id || (item.organista && item.organista.id) || item.id;
        if (!idReal) return null;
        return { organista_id: parseInt(idReal), ordem: index + 1 };
      }).filter(Boolean);

      console.log(`Salvando Ciclo ID ${cicloId}...`, itensLimpos);
      // Using the dedicated /ciclos route for reliability
      await api.put(`/ciclos/${cicloId}/itens`, { itens: itensLimpos });

      await carregarDados(); // Recarrega tudo para garantir sincronia
      alert("Ciclo salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar.");
    }
  };

  const getOrganistasDisponiveis = (cicloId) => {
    if (!todasOrganistas.length) return [];

    const cicloAtual = ciclosItens[cicloId] || [];
    const idsNoCiclo = cicloAtual.map(c => String(c.organista_id || (c.organista && c.organista.id) || c.id));

    return todasOrganistas.filter(o => !idsNoCiclo.includes(String(o.id)));
  };

  // --- CRUD CICLOS ---
  const handleNewCycle = () => {
    setEditingCycle(null);
    setCycleName('');
    setCycleOrder(metadadosCiclos.length + 1); // Next available order
    setSelectedCultosIds([]);
    setShowCycleModal(true);
  };

  const handleEditCycle = (ciclo) => {
    setEditingCycle(ciclo);
    setCycleName(ciclo.nome);
    setCycleOrder(ciclo.ordem); // Carregar ordem existente
    // Pre-select Cultos assigned to this cycle
    const assigned = todosCultos.filter(c => c.ciclo_id === ciclo.id).map(c => c.id);
    setSelectedCultosIds(assigned);
    setShowCycleModal(true);
  };

  const handleDeleteCycle = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este ciclo?")) return;
    try {
      await api.delete(`/ciclos/${id}`);
      await carregarDados();
    } catch (e) {
      alert("Erro ao excluir ciclo: " + (e.response?.data?.error || e.message));
    }
  };

  const saveCycleMeta = async () => {
    if (!cycleName) return alert("Nome obrigatorio");
    try {
      const selectedCultos = todosCultos.filter(c => selectedCultosIds.includes(c.id));
      const onlyRjmCultos = selectedCultos.length > 0 && selectedCultos.every(c => String(c.tipo || "").toLowerCase() === "rjm");
      const nomeNormalizado = String(cycleName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const tipoCiclo = (onlyRjmCultos || nomeNormalizado.includes("rjm")) ? "rjm" : "oficial";

      let cicloId = null;
      if (editingCycle) {
        await api.put(`/ciclos/${editingCycle.id}`, {
          nome: cycleName,
          ordem: cycleOrder,
          ativo: 1,
          tipo: tipoCiclo
        });
        cicloId = editingCycle.id;
      } else {
        const res = await api.post(`/ciclos`, {
          igreja_id: igrejaSelecionada,
          nome: cycleName,
          ordem: cycleOrder,
          ativo: 1,
          tipo: tipoCiclo
        });
        cicloId = res.data.id;
      }

      if (cicloId) {
        await api.put(`/ciclos/${cicloId}/cultos`, { cultos_ids: selectedCultosIds });
      }

      setShowCycleModal(false);
      carregarDados();
    } catch (e) {
      alert("Erro ao salvar ciclo: " + (e.response?.data?.error || e.message));
    }
  };

  const toggleCultoSelection = (cultoId) => {
    setSelectedCultosIds(prev => {
      if (prev.includes(cultoId)) return prev.filter(id => id !== cultoId);
      return [...prev, cultoId];
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>{"Gest\u00e3o de Ciclos"}</h3>
          <button style={styles.btnNewCycle} onClick={handleNewCycle}>+ Novo Ciclo</button>
        </div>
        <label style={styles.label}>Selecione a Igreja:</label>
        <select style={styles.select} value={igrejaSelecionada} onChange={(e) => setIgrejaSelecionada(e.target.value)}>
          {igrejas.map(ig => <option key={ig.id} value={ig.id}>{ig.nome}</option>)}
        </select>
      </div>

      {showCycleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.38)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', boxShadow: '0 10px 24px rgba(16,24,40,0.08)', padding: 20, borderRadius: 16, minWidth: 400, maxHeight: '90vh', overflowY: 'auto' }}>
            <h4>{editingCycle ? 'Editar Ciclo' : 'Novo Ciclo'}</h4>

            <div style={styles.modalSection}>
              <label style={styles.label}>Nome do Ciclo</label>
              <input
                style={styles.select}
                value={cycleName}
                onChange={e => setCycleName(e.target.value)}
                placeholder="Ex: Cultos, RJM"
              />
            </div>

            {/* Campo Ordem - NOVO */}
            <div style={styles.modalSection}>
              <label style={styles.label}>{"Ordem de Exibi\u00e7\u00e3o"}</label>
              <input
                type="number"
                min="1"
                style={styles.select}
                value={cycleOrder}
                onChange={e => setCycleOrder(parseInt(e.target.value) || 1)}
                placeholder="1, 2, 3..."
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                {"* Define a ordem em que os ciclos serao exibidos."}
              </p>
            </div>

            <div style={styles.modalSection}>
              <label style={styles.label}>Associar Cultos</label>
              <div style={styles.checkboxGroup}>
                {todosCultos.map(culto => {
                  const isAssignedToOther = culto.ciclo_id && (!editingCycle || culto.ciclo_id !== editingCycle.id);
                  const assignedToName = isAssignedToOther ? metadadosCiclos.find(c => c.id === culto.ciclo_id)?.nome : null;

                  return (
                    <label key={culto.id} style={{ display: 'flex', alignItems: 'center', gap: 5, color: isAssignedToOther ? 'var(--text-light)' : 'var(--text-main)' }}>
                      <input
                        type="checkbox"
                        checked={selectedCultosIds.includes(culto.id)}
                        onChange={() => toggleCultoSelection(culto.id)}
                        disabled={false} // Allow stealing? Yes.
                      />
                      {culto.dia_semana} - {culto.hora.substring(0, 5)} ({culto.tipo === 'rjm' ? 'RJM' : (culto.tipo === 'outro' ? 'Extra' : 'Oficial')})
                      {isAssignedToOther && <span style={{ fontSize: 10, fontStyle: 'italic' }}> (Em {assignedToName || 'Outro'})</span>}
                    </label>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                {"* Marque os cultos que serao atendidos por este ciclo."}
              </p>
            </div>

            <div style={{ marginTop: 15, display: 'flex', gap: 10 }}>
              <button style={styles.btnAddConfirm} onClick={saveCycleMeta}>Salvar</button>
              <button style={styles.btnAddCancel} onClick={() => setShowCycleModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <p style={{ textAlign: 'center' }}>Carregando...</p> : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={styles.grid}>
            {metadadosCiclos.map(ciclo => {
              // Find visible assigned cultos to display on card
              const myCultos = todosCultos.filter(c => c.ciclo_id === ciclo.id);

              return (
                <div key={ciclo.id} style={styles.card}>

                  <div style={styles.cardHeader}>
                    <div style={{ flex: 1 }}>
                      <h3 style={styles.cycleTitle}>{ciclo.nome}</h3>
                      <p style={styles.cycleSubtitle}>Ordem: {ciclo.ordem}</p>
                      {myCultos.length > 0 && (
                        <div style={styles.assignedCultos}>
                          {myCultos.map(c => (
                            <span key={c.id} style={styles.cultoTag}>{c.dia_semana.substring(0, 3)} {c.hora.substring(0, 5)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={styles.cycleActions}>
                      <button style={styles.btnAction} onClick={() => handleEditCycle(ciclo)} title="Editar ciclo">E</button>
                      <button style={{ ...styles.btnAction, color: 'var(--danger)' }} onClick={() => handleDeleteCycle(ciclo.id)} title="Excluir ciclo">X</button>
                    </div>
                  </div>

                  <Droppable droppableId={String(ciclo.id)}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        style={{
                          ...styles.listContainer,
                          backgroundColor: snapshot.isDraggingOver ? 'var(--bg-hover)' : 'transparent'
                        }}
                      >
                        {(ciclosItens[ciclo.id] || []).map((item, index) => (
                          <Draggable key={item.uniqueId} draggableId={item.uniqueId} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...styles.item,
                                  ...provided.draggableProps.style,
                                  ...(snapshot.isDragging ? styles.dragging : {})
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                  <span style={styles.rank}>{index + 1}{"\u00ba"}</span>
                                  <span style={styles.name}>{item.nome || item.organista?.nome}</span>
                                </div>
                                {item.categoria === 'rjm' ? <span style={{ ...styles.badge, ...styles.badgeRJM }}>RJM</span> :
                                  (item.categoria === 'oficial' || item.oficializada ?
                                    <span style={{ ...styles.badge, ...styles.badgeOficial }}>Oficial</span> :
                                    <span style={{ ...styles.badge, ...styles.badgeAluna }}>Aluna</span>)
                                }
                                <button style={styles.btnIcon} onClick={() => removerOrganista(ciclo.id, index)}>X</button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  <div style={styles.cardFooter}>
                    {adicionandoEmCiclo === ciclo.id ? (
                      <div style={styles.addArea}>
                        <label style={{ fontSize: 12, fontWeight: 'bold' }}>Selecione para adicionar:</label>
                        <select
                          style={styles.addSelect}
                          value={organistaSelecionadaParaAdicionar}
                          onChange={e => setOrganistaSelecionadaParaAdicionar(e.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {getOrganistasDisponiveis(ciclo.id).map(o => (
                            <option key={o.id} value={o.id}>{o.nome} ({o.categoria || (o.oficializada ? 'Oficial' : 'Aluna')})</option>
                          ))}
                        </select>
                        <div style={styles.btnAddActions}>
                          <button style={styles.btnAddConfirm} onClick={() => confirmarAdicao(ciclo.id)}>Confirmar</button>
                          <button style={styles.btnAddCancel} onClick={() => setAdicionandoEmCiclo(null)}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button style={styles.btnAddMode} onClick={() => setAdicionandoEmCiclo(ciclo.id)}>
                        + Adicionar Organista
                      </button>
                    )}

                    <button onClick={() => salvarCiclo(ciclo.id)} style={styles.btnSave}>
                      Salvar Ciclo
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}

