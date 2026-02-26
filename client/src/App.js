import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isTokenExpired } from './utils/jwt';
import {
  BellRing,
  BookOpenText,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  MessageCircle,
  Music2,
  RefreshCw,
  Settings,
  UserRound,
  Users2
} from 'lucide-react';
import Login from './pages/Login';
import Register from './pages/Register';
import InstallPrompt from './components/InstallPrompt';
import LazyLoadingFallback from './components/LazyLoadingFallback';
import './App.css';
import './styles/premium-theme.css';

const Home = lazy(() => import('./pages/Home'));
const Organistas = lazy(() => import('./pages/Organistas'));
const Igrejas = lazy(() => import('./pages/Igrejas'));
const Cultos = lazy(() => import('./pages/Cultos'));
const Rodizios = lazy(() => import('./pages/Rodizios'));
const Admin = lazy(() => import('./pages/Admin'));
const RelatoriosAdmin = lazy(() => import('./pages/RelatoriosAdmin'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const Ciclos = lazy(() => import('./pages/Ciclos'));
const Escalas = lazy(() => import('./pages/Escalas'));
const Mensagens = lazy(() => import('./pages/Mensagens'));
const NotificacoesConfig = lazy(() => import('./pages/NotificacoesConfig'));

function PrivateRoute({ children }) {
  const { loading } = useAuth();

  if (loading) {
    return <LazyLoadingFallback />;
  }

  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isTokenExpired(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('igrejas');
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
      <Sidebar user={user} location={location} onLogout={logout} />
      <div className="app-main">
        <TopHeader onLogout={logout} />
        <div className="app-content">
          <Suspense fallback={<LazyLoadingFallback />}>
            <Routes>
              <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
              <Route path="/organistas" element={<PrivateRoute><Organistas user={user} /></PrivateRoute>} />
              <Route path="/igrejas" element={<PrivateRoute><Igrejas user={user} /></PrivateRoute>} />
              <Route path="/cultos" element={<PrivateRoute><Cultos user={user} /></PrivateRoute>} />
              <Route path="/rodizios" element={<PrivateRoute><Rodizios user={user} /></PrivateRoute>} />
              <Route path="/ciclos" element={<PrivateRoute><Ciclos user={user} /></PrivateRoute>} />
              <Route path="/escalas" element={<PrivateRoute><Escalas user={user} /></PrivateRoute>} />
              {user?.role === 'admin' && (
                <>
                  <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
                  <Route path="/relatorios-admin" element={<PrivateRoute><RelatoriosAdmin user={user} /></PrivateRoute>} />
                </>
              )}
              <Route
                path="/configuracoes"
                element={user?.role === 'admin'
                  ? <PrivateRoute><Configuracoes /></PrivateRoute>
                  : <Navigate to="/" replace />
                }
              />
              {(user?.role === 'admin' || user?.tipo_usuario === 'encarregado') && (
                <>
                  <Route path="/mensagens" element={<PrivateRoute><Mensagens user={user} /></PrivateRoute>} />
                  <Route path="/notificacoes-config" element={<PrivateRoute><NotificacoesConfig user={user} /></PrivateRoute>} />
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

function Sidebar({ user, location, onLogout }) {
  const closeSidebar = () => {
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar?.classList.remove('sidebar-open');
    overlay?.classList.remove('sidebar-overlay--open');
  };

  const userName = user?.nome || user?.name || 'Usuario';
  const userInitial = (userName.trim().charAt(0) || 'U').toUpperCase();
  const userRole = user?.role === 'admin' ? 'ADMIN' : (user?.tipo_usuario || 'USUARIO').toUpperCase();

  return (
    <>
      <div className="sidebar-overlay" onClick={closeSidebar}></div>
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo"><Music2 size={18} strokeWidth={2.2} /></div>
          <div className="sidebar-brand">
            <div className="sidebar-title">Gestao</div>
            <div className="sidebar-subtitle">Organistas</div>
          </div>
        </div>

        <div className="sidebar-section-title">Menu Principal</div>

        <nav className="sidebar-nav">
          <Link to="/" className={`sidebar-nav__item ${location.pathname === '/' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon"><LayoutGrid size={18} /></span>
            <span className="sidebar-nav__text">Dashboard</span>
          </Link>
          <Link to="/organistas" className={`sidebar-nav__item ${location.pathname === '/organistas' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon"><Users2 size={18} /></span>
            <span className="sidebar-nav__text">Organistas</span>
          </Link>
          <Link to="/igrejas" className={`sidebar-nav__item ${location.pathname === '/igrejas' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon"><Building2 size={18} /></span>
            <span className="sidebar-nav__text">Igrejas</span>
          </Link>
          <Link to="/cultos" className={`sidebar-nav__item ${location.pathname === '/cultos' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon"><BookOpenText size={18} /></span>
            <span className="sidebar-nav__text">Cultos</span>
          </Link>
          <Link to="/rodizios" className={`sidebar-nav__item ${location.pathname === '/rodizios' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon"><CalendarDays size={18} /></span>
            <span className="sidebar-nav__text">Rodizios</span>
          </Link>
          <Link to="/ciclos" className={`sidebar-nav__item ${location.pathname === '/ciclos' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon"><RefreshCw size={18} /></span>
            <span className="sidebar-nav__text">Ciclos</span>
          </Link>
          <Link to="/escalas" className={`sidebar-nav__item ${location.pathname === '/escalas' ? 'active' : ''}`} onClick={closeSidebar}>
            <span className="sidebar-nav__icon"><ClipboardList size={18} /></span>
            <span className="sidebar-nav__text">Escalas</span>
          </Link>
          {(user?.role === 'admin' || user?.tipo_usuario === 'encarregado') && (
            <>
              <Link to="/mensagens" className={`sidebar-nav__item ${location.pathname === '/mensagens' ? 'active' : ''}`} onClick={closeSidebar}>
                <span className="sidebar-nav__icon"><MessageCircle size={18} /></span>
                <span className="sidebar-nav__text">Mensagens</span>
              </Link>
              <Link to="/notificacoes-config" className={`sidebar-nav__item ${location.pathname === '/notificacoes-config' ? 'active' : ''}`} onClick={closeSidebar}>
                <span className="sidebar-nav__icon"><BellRing size={18} /></span>
                <span className="sidebar-nav__text">Config. Envio</span>
              </Link>
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <Link to="/relatorios-admin" className={`sidebar-nav__item ${location.pathname === '/relatorios-admin' ? 'active' : ''}`} onClick={closeSidebar}>
                <span className="sidebar-nav__icon"><FileText size={18} /></span>
                <span className="sidebar-nav__text">Relatorios</span>
              </Link>
              <Link to="/admin" className={`sidebar-nav__item ${location.pathname === '/admin' ? 'active' : ''}`} onClick={closeSidebar}>
                <span className="sidebar-nav__icon"><UserRound size={18} /></span>
                <span className="sidebar-nav__text">Usuarios</span>
              </Link>
              <Link to="/configuracoes" className={`sidebar-nav__item ${location.pathname === '/configuracoes' ? 'active' : ''}`} onClick={closeSidebar}>
                <span className="sidebar-nav__icon"><Settings size={18} /></span>
                <span className="sidebar-nav__text">Configuracoes</span>
              </Link>
            </>
          )}
          {(user?.tipo_usuario === 'encarregado' || user?.tipo_usuario === 'examinadora' || user?.tipo_usuario === 'instrutoras') && (
            <Link to="/relatorios" className={`sidebar-nav__item ${location.pathname === '/relatorios' ? 'active' : ''}`} onClick={closeSidebar}>
              <span className="sidebar-nav__icon"><FileText size={18} /></span>
              <span className="sidebar-nav__text">Relatorios</span>
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">{userInitial}</div>
            <div className="sidebar-user-meta">
              <strong>{userName}</strong>
              <small>{userRole}</small>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => {
              closeSidebar();
              onLogout?.();
            }}
          >
            <LogOut size={16} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function TopHeader({ onLogout }) {
  const toggleSidebar = () => {
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar?.classList.toggle('sidebar-open');
    overlay?.classList.toggle('sidebar-overlay--open');
  };

  return (
    <header className="app-bar">
      <div className="left">
        <button
          className="menu-toggle"
          onClick={toggleSidebar}
          aria-label="Abrir menu lateral"
        >
          <Menu size={18} />
        </button>
      </div>
      <div className="center">Painel Admin</div>
      <div className="right">
        <button onClick={onLogout} className="logout">Sair</button>
      </div>
    </header>
  );
}

export default App;
