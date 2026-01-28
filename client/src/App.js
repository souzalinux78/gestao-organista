import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isTokenExpired } from './utils/jwt';
import Login from './pages/Login';
import Register from './pages/Register';
import InstallPrompt from './components/InstallPrompt';
import LazyLoadingFallback from './components/LazyLoadingFallback';
import './App.css';

const Organistas = lazy(() => import('./pages/Organistas'));
const Igrejas = lazy(() => import('./pages/Igrejas'));
const Cultos = lazy(() => import('./pages/Cultos'));
const Rodizios = lazy(() => import('./pages/Rodizios'));
const Admin = lazy(() => import('./pages/Admin'));
const RelatoriosAdmin = lazy(() => import('./pages/RelatoriosAdmin'));
const Relatorios = lazy(() => import('./pages/Relatorios'));

function PrivateRoute({ children }) {
  const { user, loading, logout } = useAuth();
  
  if (loading) {
    return <LazyLoadingFallback />;
  }
  
  const token = localStorage.getItem('token');
  
  // Verificar se token existe
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  // Verificar se token está expirado
  if (isTokenExpired(token)) {
    // Limpar token expirado
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('igrejas');
    // Redirecionar para login
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function AppContent() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LazyLoadingFallback />;
  }

  return (
    <div className="App">
      {user && <Header user={user} onLogout={logout} />}
      <div className="container">
        <Suspense fallback={<LazyLoadingFallback />}>
          <div className="page">
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
            {(user?.tipo_usuario === 'encarregado' || user?.tipo_usuario === 'examinadora' || user?.tipo_usuario === 'instrutoras') && (
              <Route path="/relatorios" element={<PrivateRoute><Relatorios user={user} /></PrivateRoute>} />
            )}
          </Routes>
          </div>
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
      <div className="header__content">
        <div className="header__title-wrapper">
          <img 
            src={process.env.PUBLIC_URL + '/logo.png'} 
            alt="Logo" 
            className="header__logo"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
            onLoad={(e) => {
              e.target.style.display = 'block';
            }}
          />
          <div className="header__title-container">
            <h1 className="header__title">🎹 Sistema de Gestão de Organistas</h1>
            {user && (
              <div className="header__user-info">
                {user.nome} ({user.role === 'admin' ? 'Administrador' : 'Usuário'})
              </div>
            )}
          </div>
        </div>
        {user && (
          <button 
            onClick={onLogout} 
            className="btn btn-secondary header__logout-btn"
          >
            Sair
          </button>
        )}
        <button 
          className="btn btn-secondary mobile-menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
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
        {(user?.tipo_usuario === 'encarregado' || user?.tipo_usuario === 'examinadora' || user?.tipo_usuario === 'instrutoras') && (
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
        <ul className="home__features-list">
          <li><strong>Organistas:</strong> Cadastre e gerencie as organistas</li>
          <li><strong>Igrejas:</strong> {user?.role === 'admin' ? 'Cadastre e gerencie igrejas' : 'Visualize e gerencie sua igreja'}</li>
          <li><strong>Cultos:</strong> Configure dias e horários de cultos</li>
          <li><strong>Rodízios:</strong> Gere rodízios automáticos e visualize em PDF</li>
          {user?.role === 'admin' && (
            <li><strong>Admin:</strong> Gerencie usuários e suas associações com igrejas</li>
          )}
        </ul>
        
        {igrejas.length > 0 && (
          <div className="home__igrejas-card">
            <h3 className="home__igrejas-title">Suas Igrejas:</h3>
            <ul className="home__igrejas-list">
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
