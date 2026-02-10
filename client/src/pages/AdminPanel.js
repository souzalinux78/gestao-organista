import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UsersManagement from '../components/admin/UsersManagement';
import TenantsManagement from '../components/admin/TenantsManagement';
import Metrics from '../components/admin/Metrics';
import Logs from '../components/admin/Logs';
import './AdminPanel.css';

function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  // Verificar se é admin
  if (user?.role !== 'admin') {
    return (
      <div className="admin-panel">
        <div className="card">
          <h2>Acesso Negado</h2>
          <p>Você não tem permissão para acessar esta área.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'users', label: 'Usuários', icon: '👥' },
    { id: 'tenants', label: 'Tenants', icon: '🏢' },
    { id: 'metrics', label: 'Métricas', icon: '📊' },
    { id: 'logs', label: 'Logs', icon: '📝' }
  ];

  return (
    <div className="admin-panel">
      <div className="admin-panel__sidebar">
        <div className="admin-panel__header">
          <h2>⚙️ Painel Admin</h2>
        </div>
        <nav className="admin-panel__nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`admin-panel__nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="admin-panel__nav-icon">{tab.icon}</span>
              <span className="admin-panel__nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
      
      <div className="admin-panel__content">
        {activeTab === 'users' && <UsersManagement />}
        {activeTab === 'tenants' && <TenantsManagement />}
        {activeTab === 'metrics' && <Metrics />}
        {activeTab === 'logs' && <Logs />}
      </div>
    </div>
  );
}

export default AdminPanel;
