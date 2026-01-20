import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(email, senha);
      const { token, user, igrejas } = response.data;

      // Atualizar estado do usuário através do contexto
      updateUser(user, token, igrejas);

      // Navegar para home
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
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
          <p>Entre em contato com o administrador para criar sua conta.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
