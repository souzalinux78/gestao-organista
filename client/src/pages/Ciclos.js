import React, { useState, useEffect, useCallback } from 'react';
import {
  getIgrejas,
  getCiclosIgreja,
  getCicloItens,
  saveCicloItens,
  getOrganistasParaCiclos
} from '../services/api';
import './Ciclos.css';

function Ciclos({ user }) {
  const [igrejas, setIgrejas] = useState([]);
  const [igrejaId, setIgrejaId] = useState('');
  const [ciclosInfo, setCiclosInfo] = useState(null);
  const [itensPorCiclo, setItensPorCiclo] = useState({});
  const [organistasDisponiveis, setOrganistasDisponiveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [alert, setAlert] = useState(null);
  const [dragState, setDragState] = useState({ ciclo: null, index: null });

  const loadIgrejas = useCallback(async () => {
    try {
      const res = await getIgrejas();
      setIgrejas(res.data);
    } catch (e) {
      setAlert({ message: 'Erro ao carregar igrejas', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIgrejas();
  }, [loadIgrejas]);

  useEffect(() => {
    if (user?.role !== 'admin' && igrejas.length === 1) {
      setIgrejaId(igrejas[0].id.toString());
    }
  }, [igrejas, user]);

  useEffect(() => {
    if (!igrejaId) {
      setCiclosInfo(null);
      setItensPorCiclo({});
      setOrganistasDisponiveis([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [resCiclos, resOrganistas] = await Promise.all([
          getCiclosIgreja(igrejaId),
          getOrganistasParaCiclos(igrejaId)
        ]);
        if (cancelled) return;
        setCiclosInfo(resCiclos.data);
        setOrganistasDisponiveis(resOrganistas.data || []);
        const ciclos = resCiclos.data?.ciclos || [];
        const itens = {};
        for (const c of ciclos) {
          const num = c.numero_ciclo;
          const resItens = await getCicloItens(igrejaId, num);
          if (!cancelled) itens[num] = resItens.data || [];
        }
        if (!cancelled) setItensPorCiclo(itens);
      } catch (e) {
        if (!cancelled) setAlert({ message: e.response?.data?.error || 'Erro ao carregar ciclos', type: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [igrejaId]);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleDragStart = (numeroCiclo, index) => {
    setDragState({ ciclo: numeroCiclo, index });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (numeroCiclo, dropIndex) => {
    const { ciclo, index: dragIndex } = dragState;
    if (ciclo !== numeroCiclo || dragIndex === null || dragIndex === dropIndex) {
      setDragState({ ciclo: null, index: null });
      return;
    }
    const list = [...(itensPorCiclo[numeroCiclo] || [])];
    const [removed] = list.splice(dragIndex, 1);
    let insertAt = dropIndex;
    if (dropIndex > dragIndex) insertAt -= 1;
    list.splice(insertAt, 0, removed);
    setItensPorCiclo(prev => ({ ...prev, [numeroCiclo]: list }));
    setDragState({ ciclo: null, index: null });
  };

  const handleSalvarCiclo = async (numeroCiclo) => {
    const itens = itensPorCiclo[numeroCiclo] || [];
    const payload = itens.map((item, posicao) => ({
      organista_id: item.organista_id,
      posicao
    }));
    setSaving(numeroCiclo);
    try {
      await saveCicloItens(igrejaId, numeroCiclo, payload);
      showAlert(`Ciclo ${numeroCiclo} salvo.`);
    } catch (e) {
      showAlert(e.response?.data?.error || 'Erro ao salvar', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleAdicionarAoCiclo = (numeroCiclo, organista) => {
    const list = itensPorCiclo[numeroCiclo] || [];
    if (list.some(i => i.organista_id === organista.id)) return;
    const novo = {
      id: list.length + 1,
      organista_id: organista.id,
      organista_nome: organista.nome,
      oficializada: organista.oficializada,
      posicao: list.length
    };
    setItensPorCiclo(prev => ({
      ...prev,
      [numeroCiclo]: [...(prev[numeroCiclo] || []), novo]
    }));
  };

  const handleRemoverDoCiclo = (numeroCiclo, index) => {
    const list = [...(itensPorCiclo[numeroCiclo] || [])];
    list.splice(index, 1);
    setItensPorCiclo(prev => ({ ...prev, [numeroCiclo]: list }));
  };

  const moveUp = (numeroCiclo, index) => {
    if (index <= 0) return;
    const list = [...(itensPorCiclo[numeroCiclo] || [])];
    [list[index - 1], list[index]] = [list[index], list[index - 1]];
    setItensPorCiclo(prev => ({ ...prev, [numeroCiclo]: list }));
  };

  const moveDown = (numeroCiclo, index) => {
    const list = itensPorCiclo[numeroCiclo] || [];
    if (index >= list.length - 1) return;
    const newList = [...list];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setItensPorCiclo(prev => ({ ...prev, [numeroCiclo]: newList }));
  };

  if (loading) {
    return (
      <div className="page-ciclos">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="page-ciclos">
      <header className="page-ciclos__header">
        <h1>Gestão de Ciclos</h1>
        <p className="page-ciclos__subtitle">
          N cultos = N ciclos. Defina a ordem das organistas em cada ciclo. O rodízio alterna qual ciclo atende cada culto por semana.
        </p>
      </header>

      {alert && (
        <div className={`alert alert--${alert.type}`}>
          {alert.message}
        </div>
      )}

      <div className="page-ciclos__filtro">
        <label>Igreja</label>
        <select
          value={igrejaId}
          onChange={(e) => setIgrejaId(e.target.value)}
          className="page-ciclos__select"
        >
          <option value="">Selecione</option>
          {igrejas.map((i) => (
            <option key={i.id} value={i.id}>{i.nome}</option>
          ))}
        </select>
      </div>

      {!igrejaId && (
        <p className="page-ciclos__empty">Selecione uma igreja para gerenciar os ciclos.</p>
      )}

      {igrejaId && ciclosInfo && ciclosInfo.total_ciclos === 0 && (
        <p className="page-ciclos__empty">Esta igreja não possui cultos ativos. Cadastre cultos para criar ciclos.</p>
      )}

      {igrejaId && ciclosInfo && ciclosInfo.total_ciclos > 0 && (
        <div className="ciclos-grid">
          {(ciclosInfo.ciclos || []).map((c) => (
            <section key={c.numero_ciclo} className="ciclo-card">
              <h2 className="ciclo-card__titulo">
                Ciclo {c.numero_ciclo}
                {c.culto && (
                  <span className="ciclo-card__culto">
                    {c.culto.dia_semana} {c.culto.hora && String(c.culto.hora).slice(0, 5)}
                  </span>
                )}
              </h2>
              <p className="ciclo-card__dica">Use as setas para reordenar ou arraste. Salve após alterar.</p>
              <ul className="ciclo-lista" onDragOver={handleDragOver}>
                {(itensPorCiclo[c.numero_ciclo] || []).map((item, index) => {
                  const list = itensPorCiclo[c.numero_ciclo] || [];
                  const isFirst = index === 0;
                  const isLast = index === list.length - 1;
                  const isOficial = item.oficializada === 1 || item.oficializada === true;
                  return (
                    <li
                      key={`${item.organista_id}-${index}`}
                      className="ciclo-lista__item"
                      draggable
                      onDragStart={(ev) => {
                        handleDragStart(c.numero_ciclo, index);
                        ev.dataTransfer.setData('text/plain', String(index));
                        ev.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(ev) => {
                        ev.preventDefault();
                        ev.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        handleDrop(c.numero_ciclo, index);
                      }}
                    >
                      <span className="ciclo-lista__ordem" aria-label={`Posição ${index + 1}`}>
                        {index + 1}º
                      </span>
                      <span className="ciclo-lista__nome">{item.organista_nome}</span>
                      {isOficial ? (
                        <span className="ciclo-lista__badge ciclo-lista__badge--oficial" title="Oficializada (pode tocar culto e meia hora)">
                          <span className="ciclo-lista__badge-icon" aria-hidden>✓</span> Oficial
                        </span>
                      ) : (
                        <span className="ciclo-lista__badge ciclo-lista__badge--aluna" title="Aluna (apenas meia hora)">
                          Aluna
                        </span>
                      )}
                      <div className="ciclo-lista__acoes">
                        <button
                          type="button"
                          className="ciclo-lista__btn ciclo-lista__btn--up"
                          onClick={() => moveUp(c.numero_ciclo, index)}
                          disabled={isFirst}
                          title="Subir uma posição"
                          aria-label="Subir uma posição"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="ciclo-lista__btn ciclo-lista__btn--down"
                          onClick={() => moveDown(c.numero_ciclo, index)}
                          disabled={isLast}
                          title="Descer uma posição"
                          aria-label="Descer uma posição"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          className="ciclo-lista__remover"
                          onClick={() => handleRemoverDoCiclo(c.numero_ciclo, index)}
                          title="Remover do ciclo"
                          aria-label="Remover do ciclo"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="ciclo-card__acoes">
                <details className="ciclo-add">
                  <summary>Adicionar organista</summary>
                  <ul className="ciclo-add-lista">
                    {organistasDisponiveis
                      .filter((o) => !(itensPorCiclo[c.numero_ciclo] || []).some((i) => i.organista_id === o.id))
                      .map((o) => (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => handleAdicionarAoCiclo(c.numero_ciclo, o)}
                          >
                            {o.nome} {o.oficializada ? '✓' : '(Aluna)'}
                          </button>
                        </li>
                      ))}
                    {organistasDisponiveis.length === 0 && <li>Nenhuma organista na igreja.</li>}
                  </ul>
                </details>
                <button
                  type="button"
                  className="ciclo-card__salvar"
                  disabled={saving === c.numero_ciclo}
                  onClick={() => handleSalvarCiclo(c.numero_ciclo)}
                >
                  {saving === c.numero_ciclo ? 'Salvando...' : 'Salvar ciclo'}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default Ciclos;
