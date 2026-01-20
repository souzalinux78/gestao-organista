import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Organistas from './pages/Organistas';
import Igrejas from './pages/Igrejas';
import Cultos from './pages/Cultos';
import Rodizios from './pages/Rodizios';
import Admin from './pages/Admin';
import InstallPrompt from './components/InstallPrompt';
import './App.css';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('igrejas');
    setUser(null);
    window.location.href = '/login';
  };

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <Router>
      <div className="App">
        {user && <Header user={user} onLogout={handleLogout} />}
        <div className="container">
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/" element={<PrivateRoute><Home user={user} /></PrivateRoute>} />
            <Route path="/organistas" element={<PrivateRoute><Organistas /></PrivateRoute>} />
            <Route path="/igrejas" element={<PrivateRoute><Igrejas user={user} /></PrivateRoute>} />
            <Route path="/cultos" element={<PrivateRoute><Cultos user={user} /></PrivateRoute>} />
            <Route path="/rodizios" element={<PrivateRoute><Rodizios user={user} /></PrivateRoute>} />
            {user?.role === 'admin' && (
              <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
            )}
          </Routes>
        </div>
        <InstallPrompt />
      </div>
    </Router>
  );
}

function Header({ user, onLogout }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  
  return (
    <div className="header">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img 
            src={process.env.PUBLIC_URL + '/logo.png'} 
            alt="Logo" 
            style={{ 
              height: '50px', 
              width: 'auto',
              display: 'none' 
            }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
            onLoad={(e) => {
              e.target.style.display = 'block';
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 2rem)', wordBreak: 'break-word', margin: 0 }}>🎹 Sistema de Gestão de Organistas</h1>
            {user && (
              <div style={{ fontSize: '0.9rem', marginTop: '5px', opacity: 0.9 }}>
                {user.nome} ({user.role === 'admin' ? 'Administrador' : 'Usuário'})
              </div>
            )}
          </div>
        </div>
        {user && (
          <button 
            onClick={onLogout} 
            className="btn btn-secondary" 
            style={{ marginLeft: 'auto' }}
          >
            Sair
          </button>
        )}
        <button 
          className="btn btn-secondary mobile-menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ display: 'none' }}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
      <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
        <Link to="/" className={location.pathname === '/' ? 'active' : ''} onClick={() => setMenuOpen(false)}>
          Início
        </Link>
        <Link to="/organistas" className={location.pathname === '/organistas' ? 'active' : ''} onClick={() => setMenuOpen(false)}>
          Organistas
        </Link>
        <Link to="/igrejas" className={location.pathname === '/igrejas' ? 'active' : ''} onClick={() => setMenuOpen(false)}>
          Igrejas
        </Link>
        <Link to="/cultos" className={location.pathname === '/cultos' ? 'active' : ''} onClick={() => setMenuOpen(false)}>
          Cultos
        </Link>
        <Link to="/rodizios" className={location.pathname === '/rodizios' ? 'active' : ''} onClick={() => setMenuOpen(false)}>
          Rodízios
        </Link>
        {user?.role === 'admin' && (
          <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''} onClick={() => setMenuOpen(false)}>
            Admin
          </Link>
        )}
      </nav>
    </div>
  );
}

function Home({ user }) {
  const igrejas = JSON.parse(localStorage.getItem('igrejas') || '[]');
  
  return (
    <div>
      <div className="card">
        <h2>Bem-vindo, {user?.nome}!</h2>
        <p>Use o menu acima para navegar pelas funcionalidades:</p>
        <ul style={{ marginTop: '20px', paddingLeft: '20px' }}>
          <li><strong>Organistas:</strong> Cadastre e gerencie as organistas</li>
          <li><strong>Igrejas:</strong> {user?.role === 'admin' ? 'Cadastre e gerencie igrejas' : 'Visualize e gerencie sua igreja'}</li>
          <li><strong>Cultos:</strong> Configure dias e horários de cultos</li>
          <li><strong>Rodízios:</strong> Gere rodízios automáticos e visualize em PDF</li>
          {user?.role === 'admin' && (
            <li><strong>Admin:</strong> Gerencie usuários e suas associações com igrejas</li>
          )}
        </ul>
        
        {igrejas.length > 0 && (
          <div style={{ marginTop: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '10px' }}>Suas Igrejas:</h3>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {igrejas.map(igreja => (
                <li key={igreja.id}>{igreja.nome}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
