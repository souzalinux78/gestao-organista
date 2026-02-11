import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// --- ESTILOS VISUAIS ---
const styles = {
  container: { padding: '20px', backgroundColor: '#f8f9fa', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
  header: { marginBottom: '25px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #eaeaea' },
  label: { display: 'block', marginBottom: '8px', fontWeight: '600', color: '#555' },
  select: { padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', maxWidth: '400px' },
  
  // Grid ajustado (Wrap)
  grid: { display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' },
  
  card: { 
    background: 'white', borderRadius: '8px', padding: '20px', 
    width: '350px', 
    border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
    display: 'flex', flexDirection: 'column'
  },
  cardHeader: { marginBottom: '15px' },
  cycleTitle: { margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#333' },
  cycleSubtitle: { margin: 0, fontSize: '14px', color: '#888', marginTop: '4px' },
  
  listContainer: { minHeight: '200px' },
  
  item: { 
    padding: '10px 12px', marginBottom: '8px', backgroundColor: '#fff', 
    // CORREÇÃO: Usando a propriedade border completa sempre
    border: '1px solid #f0f0f0', 
    borderRadius: '6px', 
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
  },
  dragging: { 
    backgroundColor: '#fff9c4', 
    // CORREÇÃO: Substituindo apenas a cor ou redefinindo o border completo, nunca misturando
    border: '1px solid #fbc02d', 
    boxShadow: '0 5px 15px rgba(0,0,0,0.1)' 
  },
  
  rank: { fontWeight: 'bold', color: '#555', width: '25px', fontSize: '14px' },
  name: { flex: 1, fontSize: '15px', color: '#333', fontWeight: '500' },
  
  badge: { fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: '600', textTransform: 'uppercase', marginLeft: '8px' },
  badgeOficial: { backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9' },
  badgeAluna: { backgroundColor: '#fff3e0', color: '#ef6c00', border: '1px solid #ffe0b2' },
  
  btnIcon: { background: 'none', border: '1px solid #eee', cursor: 'pointer', color: '#d32f2f', borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  
  cardFooter: { marginTop: '20px', borderTop: '1px solid #f5f5f5', paddingTop: '15px' },
  btnAddMode: { background: 'none', border: 'none', color: '#d4b106', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center', padding: '10px' },
  
  addArea: { display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '6px', border: '1px solid #eee' },
  addSelect: { padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '100%' },
  btnAddActions: { display: 'flex', gap: '5px' },
  btnAddConfirm: { padding: '8px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1 },
  btnAddCancel: { padding: '8px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1 },
  
  btnSave: { width: '100%', padding: '10px', backgroundColor: '#d4b106', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px', fontSize: '14px' }
};

export default function Ciclos() {
  const [igrejas, setIgrejas] = useState([]);
  const [igrejaSelecionada, setIgrejaSelecionada] = useState('');
  const [todasOrganistas, setTodasOrganistas] = useState([]); 
  const [ciclos, setCiclos] = useState({ 1: [], 2: [], 3: [] });
  const [loading, setLoading] = useState(true);
  
  // Estado para controlar Adicionar
  const [adicionandoEmCiclo, setAdicionandoEmCiclo] = useState(null); 
  const [organistaSelecionadaParaAdicionar, setOrganistaSelecionadaParaAdicionar] = useState('');

  const infoCiclos = {
    1: { dia: 'Quinta', hora: '19:30' },
    2: { dia: 'Sábado', hora: '19:30' },
    3: { dia: 'Domingo', hora: '18:30' }
  };

  const getToken = () => localStorage.getItem('token');
  const api = axios.create({ baseURL: '/api', headers: { 'Authorization': `Bearer ${getToken()}` } });

  useEffect(() => { carregarIgrejas(); }, []);

  useEffect(() => {
    if (igrejaSelecionada) {
      carregarCiclos(igrejaSelecionada);
      carregarTodasOrganistas(igrejaSelecionada);
    }
  }, [igrejaSelecionada]);

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

  const carregarTodasOrganistas = async (idIgreja) => {
    try {
      const response = await api.get(`/igrejas/${idIgreja}/organistas`);
      setTodasOrganistas(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar lista de organistas:", error);
    }
  };

  const carregarCiclos = async (idIgreja) => {
    setLoading(true);
    try {
      const response = await api.get(`/igrejas/${idIgreja}/ciclos-organistas`);
      const dados = response.data;
      
      const organizados = { 1: [], 2: [], 3: [] };
      dados.forEach((item, index) => {
        const numCiclo = item.ciclo || 1;
        if (!organizados[numCiclo]) organizados[numCiclo] = [];
        
        // Determina o ID real da organista para usar na chave
        const orgId = item.organista_id || (item.organista && item.organista.id) || item.id;
        
        organizados[numCiclo].push({
          ...item,
          uniqueId: `C${numCiclo}-ORG${orgId}-IDX${index}`
        });
      });

      Object.keys(organizados).forEach(key => {
        organizados[key].sort((a, b) => a.ordem - b.ordem);
      });

      setCiclos(organizados);
    } catch (error) {
      console.error("Erro ao carregar ciclos:", error);
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const cicloOrigem = source.droppableId;
    const cicloDestino = destination.droppableId;

    const novosCiclos = { ...ciclos };
    const listaOrigem = [...novosCiclos[cicloOrigem]];
    const listaDestino = cicloOrigem === cicloDestino ? listaOrigem : [...novosCiclos[cicloDestino]];

    const [removido] = listaOrigem.splice(source.index, 1);
    listaDestino.splice(destination.index, 0, removido);

    novosCiclos[cicloOrigem] = listaOrigem;
    novosCiclos[cicloDestino] = listaDestino;
    setCiclos(novosCiclos);
  };

  const removerOrganista = (numCiclo, index) => {
    if (!window.confirm("Remover esta organista do ciclo?")) return;
    const novosCiclos = { ...ciclos };
    novosCiclos[numCiclo].splice(index, 1);
    setCiclos(novosCiclos);
  };

  const abrirAdicionar = (numCiclo) => {
    setAdicionandoEmCiclo(numCiclo);
    setOrganistaSelecionadaParaAdicionar('');
  };

  const confirmarAdicao = (numCiclo) => {
    if (!organistaSelecionadaParaAdicionar) return;
    
    // Converte para string para garantir comparação correta
    const idBusca = String(organistaSelecionadaParaAdicionar);
    const organistaOriginal = todasOrganistas.find(o => String(o.id) === idBusca);
    
    if (!organistaOriginal) {
        alert("Erro: Organista não encontrada na lista.");
        return;
    }

    const novosCiclos = { ...ciclos };
    
    const novoItem = {
      organista_id: organistaOriginal.id,
      id: organistaOriginal.id, // Fallback
      nome: organistaOriginal.nome,
      oficializada: organistaOriginal.oficializada,
      organista: { nome: organistaOriginal.nome, id: organistaOriginal.id },
      uniqueId: `C${numCiclo}-NEW${organistaOriginal.id}-${Date.now()}`
    };

    novosCiclos[numCiclo].push(novoItem);
    setCiclos(novosCiclos);
    
    setAdicionandoEmCiclo(null);
    setOrganistaSelecionadaParaAdicionar('');
  };

  const salvarCiclo = async (numeroCiclo) => {
    if (!igrejaSelecionada) return;
    try {
      const itens = ciclos[numeroCiclo];
      const itensLimpos = itens.map((item, index) => {
        // Tenta pegar o ID de todas as formas possíveis
        const idReal = item.organista_id || (item.organista && item.organista.id) || item.id;
        
        if (!idReal) return null;
        return { organista_id: parseInt(idReal), ordem: index + 1 };
      }).filter(Boolean);

      console.log(`Salvando Ciclo ${numeroCiclo}...`, itensLimpos);
      await api.put(`/igrejas/${igrejaSelecionada}/ciclos/${numeroCiclo}`, { itens: itensLimpos });
      
      await carregarCiclos(igrejaSelecionada);
      alert(`✅ Ciclo ${numeroCiclo} salvo com sucesso!`);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar.");
    }
  };

  // Filtra as organistas disponíveis para o dropdown (remove as que já estão no ciclo)
  const getOrganistasDisponiveis = (numCiclo) => {
    if (!todasOrganistas.length) return [];
    
    const cicloAtual = ciclos[numCiclo] || [];
    const idsNoCiclo = cicloAtual.map(c => String(c.organista_id || (c.organista && c.organista.id) || c.id));
    
    return todasOrganistas.filter(o => !idsNoCiclo.includes(String(o.id)));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3>Gestão de Ciclos</h3>
        <label style={styles.label}>Selecione a Igreja:</label>
        <select style={styles.select} value={igrejaSelecionada} onChange={(e) => setIgrejaSelecionada(e.target.value)}>
          {igrejas.map(ig => <option key={ig.id} value={ig.id}>{ig.nome}</option>)}
        </select>
      </div>

      {loading ? <p style={{textAlign:'center'}}>Carregando...</p> : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={styles.grid}>
            {[1, 2, 3].map(numCiclo => (
              <div key={numCiclo} style={styles.card}>
                
                <div style={styles.cardHeader}>
                    <h3 style={styles.cycleTitle}>Ciclo {numCiclo}</h3>
                    <p style={styles.cycleSubtitle}>
                        {infoCiclos[numCiclo]?.dia} {infoCiclos[numCiclo]?.hora}
                    </p>
                </div>

                <Droppable droppableId={String(numCiclo)}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      style={{ 
                          ...styles.listContainer,
                          backgroundColor: snapshot.isDraggingOver ? '#fafafa' : 'transparent'
                      }}
                    >
                      {ciclos[numCiclo]?.map((item, index) => (
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
                              <div style={{display:'flex', alignItems:'center', flex:1}}>
                                <span style={styles.rank}>{index + 1}º</span>
                                <span style={styles.name}>{item.nome || item.organista?.nome}</span>
                              </div>
                              {item.oficializada ? 
                                <span style={{...styles.badge, ...styles.badgeOficial}}>Oficial</span> : 
                                <span style={{...styles.badge, ...styles.badgeAluna}}>Aluna</span>
                              }
                              <button style={styles.btnIcon} onClick={() => removerOrganista(numCiclo, index)}>✕</button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                <div style={styles.cardFooter}>
                    {adicionandoEmCiclo === numCiclo ? (
                        <div style={styles.addArea}>
                            <label style={{fontSize:12, fontWeight:'bold'}}>Selecione para adicionar:</label>
                            <select 
                                style={styles.addSelect}
                                value={organistaSelecionadaParaAdicionar}
                                onChange={e => setOrganistaSelecionadaParaAdicionar(e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {getOrganistasDisponiveis(numCiclo).map(o => (
                                    <option key={o.id} value={o.id}>{o.nome}</option>
                                ))}
                            </select>
                            <div style={styles.btnAddActions}>
                                <button style={styles.btnAddConfirm} onClick={() => confirmarAdicao(numCiclo)}>Confirmar</button>
                                <button style={styles.btnAddCancel} onClick={() => setAdicionandoEmCiclo(null)}>Cancelar</button>
                            </div>
                        </div>
                    ) : (
                        <button style={styles.btnAddMode} onClick={() => abrirAdicionar(numCiclo)}>
                           + Adicionar Organista
                        </button>
                    )}
                    
                    <button onClick={() => salvarCiclo(numCiclo)} style={styles.btnSave}>
                        Salvar Ciclo
                    </button>
                </div>

              </div>
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}