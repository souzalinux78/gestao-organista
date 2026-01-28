import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { login } from '../services/api';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  // Adicionar classe ao body quando estiver na página de login
  useEffect(() => {
    document.body.classList.add('login-page');
    document.documentElement.classList.add('login-page');
    
    return () => {
      document.body.classList.remove('login-page');
      document.documentElement.classList.remove('login-page');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevenir múltiplos submits
    
    // Prevenir submit se já estiver carregando
    if (loading) {
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const response = await login(email, senha);
      const { token, user, igrejas } = response.data;

      // Atualizar estado do usuário através do contexto
      updateUser(user, token, igrejas);

      // Navegar para home usando replace para evitar histórico
      navigate('/', { replace: true });
    } catch (err) {
      // Não redirecionar em caso de erro - apenas mostrar mensagem
      const errorMessage = err.response?.data?.error || err.message || 'Erro ao fazer login';
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img 
            src={process.env.PUBLIC_URL + '/logo.png'} 
            alt="Logo" 
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
        <h1>🎹 Sistema de Gestão de Organistas</h1>
        <h2>Login</h2>
        
        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="login-info">
          <p><strong>Primeiro acesso?</strong></p>
          <p>
            <Link to="/cadastro" className="login-info__link">
              Clique aqui para se cadastrar
            </Link>
          </p>
          <p className="login-info__text">
            Após o cadastro, aguarde a aprovação do administrador.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
