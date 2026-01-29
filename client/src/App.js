import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isTokenExpired } from './utils/jwt';
import Login from './pages/Login';
import Register from './pages/Register';
import InstallPrompt from './components/InstallPrompt';
import LazyLoadingFallback from './components/LazyLoadingFallback';
import ThemeToggle from './components/ThemeToggle';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const Organistas = lazy(() => import('./pages/Organistas'));
const Igrejas = lazy(() => import('./pages/Igrejas'));
const Cultos = lazy(() => import('./pages/Cultos'));
const Rodizios = lazy(() => import('./pages/Rodizios'));
const Admin = lazy(() => import('./pages/Admin'));
const RelatoriosAdmin = lazy(() => import('./pages/RelatoriosAdmin'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));

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

  // Se não estiver logado, mostrar layout normal (login/register)
  if (!user) {
    return (
      <div className="App">
        <Suspense fallback={<LazyLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/cadastro" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  return (
    <div className="App App--with-sidebar">
      {user && <Sidebar user={user} location={location} />}
      <div className="app-main">
        {user && <TopHeader user={user} onLogout={logout} />}
        <div className="app-content">
          <Suspense fallback={<LazyLoadingFallback />}>
            <Routes>
              <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
              <Route path="/organistas" element={<PrivateRoute><Organistas user={user} /></PrivateRoute>} />
              <Route path="/igrejas" element={<PrivateRoute><Igrejas user={user} /></PrivateRoute>} />
              <Route path="/cultos" element={<PrivateRoute><Cultos user={user} /></PrivateRoute>} />
              <Route path="/rodizios" element={<PrivateRoute><Rodizios user={user} /></PrivateRoute>} />
              {user?.role === 'admin' && (
                <>
                  <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
                  <Route path="/relatorios-admin" element={<PrivateRoute><RelatoriosAdmin user={user} /></PrivateRoute>} />
                  <Route path="/configuracoes" element={<PrivateRoute><Configuracoes /></PrivateRoute>} />
                </>
              )}
              {(user?.tipo_usuario === 'encarregado' || user?.tipo_usuario === 'examinadora' || user?.tipo_usuario === 'instrutoras') && (
                <Route path="/relatorios" element={<PrivateRoute><Relatorios user={user} /></PrivateRoute>} />
              )}
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/register" element={<Navigate to="/" replace />} />
              <Route path="/cadastro" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
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

function Sidebar({ user, location }) {
  const closeSidebar = () => {
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar?.classList.remove('sidebar-open');
    overlay?.classList.remove('sidebar-overlay--open');
  };
  
  return (
    <>
      <div className="sidebar-overlay" onClick={closeSidebar}></div>
      <div className="app-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">🎹</div>
          <div className="sidebar-title">Gestão Organistas</div>
        </div>
        <nav className="sidebar-nav">
          <Link to="/" className={`sidebar-nav__item ${location.pathname === '/' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon">📊</span>
            <span className="sidebar-nav__text">Dashboard</span>
          </Link>
          <Link to="/organistas" className={`sidebar-nav__item ${location.pathname === '/organistas' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon">👥</span>
            <span className="sidebar-nav__text">Organistas</span>
          </Link>
          <Link to="/igrejas" className={`sidebar-nav__item ${location.pathname === '/igrejas' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon">🏢</span>
            <span className="sidebar-nav__text">Igrejas</span>
          </Link>
          <Link to="/cultos" className={`sidebar-nav__item ${location.pathname === '/cultos' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon">📖</span>
            <span className="sidebar-nav__text">Cultos</span>
          </Link>
          <Link to="/rodizios" className={`sidebar-nav__item ${location.pathname === '/rodizios' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon">📅</span>
            <span className="sidebar-nav__text">Rodízios</span>
          </Link>
          {user?.role === 'admin' && (
            <>
              <Link to="/relatorios-admin" className={`sidebar-nav__item ${location.pathname === '/relatorios-admin' ? 'active' : ''}`} onClick={closeSidebar}>
                <span className="sidebar-nav__icon">📄</span>
                <span className="sidebar-nav__text">Relatórios</span>
              </Link>
              <Link to="/admin" className={`sidebar-nav__item ${location.pathname === '/admin' ? 'active' : ''}`} onClick={closeSidebar}>
                <span className="sidebar-nav__icon">👤</span>
                <span className="sidebar-nav__text">Usuários</span>
              </Link>
              <Link to="/configuracoes" className={`sidebar-nav__item ${location.pathname === '/configuracoes' ? 'active' : ''}`} onClick={closeSidebar}>
                <span className="sidebar-nav__icon">⚙️</span>
                <span className="sidebar-nav__text">Configurações</span>
              </Link>
            </>
          )}
          {(user?.tipo_usuario === 'encarregado' || user?.tipo_usuario === 'examinadora' || user?.tipo_usuario === 'instrutoras') && (
            <Link to="/relatorios" className={`sidebar-nav__item ${location.pathname === '/relatorios' ? 'active' : ''}`} onClick={closeSidebar}>
              <span className="sidebar-nav__icon">📄</span>
              <span className="sidebar-nav__text">Relatórios</span>
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}

function TopHeader({ user, onLogout }) {
  const [igrejas, setIgrejas] = useState([]);
  
  useEffect(() => {
    const igrejasData = localStorage.getItem('igrejas');
    if (igrejasData) {
      try {
        setIgrejas(JSON.parse(igrejasData));
      } catch (e) {
        console.error('Erro ao parsear igrejas:', e);
      }
    }
  }, []);
  
  const toggleSidebar = () => {
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar?.classList.toggle('sidebar-open');
    overlay?.classList.toggle('sidebar-overlay--open');
  };
  
  return (
    <>
      <header className="app-bar">
        <div className="left">
          <button
            className="app-bar__menu"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
        </div>
        <div className="center">
          Painel Admin
        </div>
        <div className="right">
          <ThemeToggle />
          <span className="app-bar__user">{user?.nome} - {igrejas?.[0]?.nome || 'Sistema'}</span>
          <button onClick={onLogout} className="app-bar__logout">
            Sair
          </button>
        </div>
      </header>
      <section className="user-bar">
        <span className="user-name">{user?.nome} - {igrejas?.[0]?.nome || 'Sistema'}</span>
        <button onClick={onLogout} className="logout">
          Sair
        </button>
      </section>
    </>
  );
}


export default App;
