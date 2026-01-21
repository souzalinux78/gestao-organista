import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/api';
import './Login.css';

function Register() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [igreja, setIgreja] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Adicionar classe ao body quando estiver na página de cadastro
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
    setError('');
    setSuccess('');
    setLoading(true);

    // Validações
    if (senha.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      setLoading(false);
      return;
    }

    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    if (!igreja || igreja.trim() === '') {
      setError('O campo Igreja/Comum é obrigatório');
      setLoading(false);
      return;
    }

    try {
      const response = await register(nome, email, senha, igreja.trim());
      setSuccess(response.data.message || 'Cadastro realizado com sucesso! Aguarde a aprovação do administrador.');
      
      // Limpar formulário
      setNome('');
      setEmail('');
      setSenha('');
      setConfirmarSenha('');
      setIgreja('');
      
      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao realizar cadastro');
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
        <h2>Cadastro</h2>
        
        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        {success && (
          <div className="alert alert-success">{success}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome Completo *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              autoFocus
              placeholder="Seu nome completo"
            />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
            />
          </div>

          <div className="form-group">
            <label>Senha *</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div className="form-group">
            <label>Confirmar Senha *</label>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              minLength={6}
              placeholder="Digite a senha novamente"
            />
          </div>

          <div className="form-group">
            <label>Igreja/Comum *</label>
            <input
              type="text"
              value={igreja}
              onChange={(e) => setIgreja(e.target.value)}
              required
              placeholder="Ex: Bairro do Cruzeiro"
            />
            <small style={{ display: 'block', marginTop: '6px', color: '#666' }}>
              Nome da igreja ou comum que você representa
            </small>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>

        <div className="login-info" style={{ marginTop: '20px' }}>
          <p>Já tem uma conta? <Link to="/login" style={{ color: '#2E86AB', fontWeight: '600' }}>Faça login</Link></p>
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '10px' }}>
            Após o cadastro, aguarde a aprovação do administrador para acessar o sistema.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
