import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import InstallPrompt from './components/InstallPrompt';
import './App.css';

const Organistas = lazy(() => import('./pages/Organistas'));
const Igrejas = lazy(() => import('./pages/Igrejas'));
const Cultos = lazy(() => import('./pages/Cultos'));
const Rodizios = lazy(() => import('./pages/Rodizios'));
const Admin = lazy(() => import('./pages/Admin'));
const RelatoriosAdmin = lazy(() => import('./pages/RelatoriosAdmin'));
const Relatorios = lazy(() => import('./pages/Relatorios'));

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Carregando...</div>;
  }
  
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

function AppContent() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return (
    <div className="App">
      {user && <Header user={user} onLogout={logout} />}
      <div className="container">
        <Suspense fallback={<div className="loading">Carregando...</div>}>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
            <Route path="/cadastro" element={!user ? <Register /> : <Navigate to="/" />} />
            <Route path="/" element={<PrivateRoute><Home user={user} /></PrivateRoute>} />
            <Route path="/organistas" element={<PrivateRoute><Organistas user={user} /></PrivateRoute>} />
            <Route path="/igrejas" element={<PrivateRoute><Igrejas user={user} /></PrivateRoute>} />
            <Route path="/cultos" element={<PrivateRoute><Cultos user={user} /></PrivateRoute>} />
            <Route path="/rodizios" element={<PrivateRoute><Rodizios user={user} /></PrivateRoute>} />
            {user?.role === 'admin' && (
              <>
                <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
                <Route path="/relatorios-admin" element={<PrivateRoute><RelatoriosAdmin user={user} /></PrivateRoute>} />
              </>
            )}
            {(user?.tipo_usuario === 'encarregado' || user?.tipo_usuario === 'examinadora') && (
              <Route path="/relatorios" element={<PrivateRoute><Relatorios user={user} /></PrivateRoute>} />
            )}
          </Routes>
        </Suspense>
      </div>
      {location.pathname !== '/login' && location.pathname !== '/register' && location.pathname !== '/cadastro' && <InstallPrompt />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
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
          style={{ display: 'none', minWidth: '44px', minHeight: '44px' }}
          aria-label="Toggle menu"
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
          <>
            <Link to="/relatorios-admin" className={location.pathname === '/relatorios-admin' ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              Relatórios
            </Link>
            <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              Admin
            </Link>
          </>
        )}
        {(user?.tipo_usuario === 'encarregado' || user?.tipo_usuario === 'examinadora') && (
          <Link to="/relatorios" className={location.pathname === '/relatorios' ? 'active' : ''} onClick={() => setMenuOpen(false)}>
            Relatórios
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
