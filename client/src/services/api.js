import axios from 'axios';
import { isTokenExpired } from './utils/jwt';

const api = axios.create({
  baseURL: '/api',
  // Evita "ficar salvando para sempre" quando o backend/proxy não responde.
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para adicionar token e verificar expiração
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    if (token) {
      // Verificar se token está expirado antes de enviar
      if (isTokenExpired(token)) {
        // Limpar token expirado
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('igrejas');
        
        // Rejeitar requisição com erro de autenticação
        return Promise.reject({
          response: {
            status: 401,
            data: { error: 'Token expirado' }
          },
          isTokenExpired: true
        });
      }
      
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros de autenticação e servidor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Erro de autenticação (incluindo token expirado)
    if (error.response?.status === 401 || error.isTokenExpired) {
      // Verificar se estamos em uma rota pública (login, register, cadastro)
      const currentPath = window.location.pathname;
      const rotasPublicas = ['/login', '/register', '/cadastro'];
      const isRotaPublica = rotasPublicas.includes(currentPath);
      
      // Verificar se é uma requisição de autenticação (login/register)
      const isAuthRequest = error.config?.url?.includes('/auth/login') || 
                           error.config?.url?.includes('/auth/register');
      
      // Limpar dados de autenticação apenas se não for uma requisição de autenticação
      // (para não limpar durante tentativa de login/cadastro)
      if (!isAuthRequest) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('igrejas');
      }
      
      // Só redirecionar se:
      // 1. NÃO estiver em rota pública
      // 2. NÃO for uma requisição de autenticação (login/register)
      // 3. Já não estiver na página de login
      if (!isRotaPublica && !isAuthRequest && currentPath !== '/login') {
        // Usar uma flag para evitar múltiplos redirecionamentos
        if (!window._redirectingToLogin) {
          window._redirectingToLogin = true;
          setTimeout(() => {
            window._redirectingToLogin = false;
            if (window.location.pathname !== '/login') {
              // Usar replace para evitar histórico e reload completo
              window.location.replace('/login');
            }
          }, 100);
        }
      }
      
      return Promise.reject(error);
    }
    
    // Erro 502/503 - Servidor indisponível
    if (error.response?.status === 502 || error.response?.status === 503) {
      console.error('[API] Servidor indisponível (502/503). Verifique se o backend está rodando.');
      // Não fazer reload automático - apenas mostrar erro
      return Promise.reject({
        ...error,
        message: 'Servidor temporariamente indisponível. Tente novamente em alguns instantes.',
        isServerError: true
      });
    }
    
    // Erro de timeout
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return Promise.reject({
        ...error,
        message: 'Tempo limite excedido. O servidor demorou para responder.',
        isTimeout: true
      });
    }
    
    // Erro de rede
    if (!error.response) {
      return Promise.reject({
        ...error,
        message: 'Erro de conexão. Verifique sua internet e tente novamente.',
        isNetworkError: true
      });
    }
    
    return Promise.reject(error);
  }
);

// Autenticação
export const login = (email, senha) => api.post('/auth/login', { email, senha });
export const register = (nome, email, senha, igreja, tipoUsuario = null) => api.post('/auth/register', { nome, email, senha, igreja, tipo_usuario: tipoUsuario });
export const getMe = () => api.get('/auth/me');
export const createUsuario = (data) => api.post('/auth/usuarios', data);
export const getUsuarios = () => api.get('/auth/usuarios');
export const updateUsuario = (id, data) => api.put(`/auth/usuarios/${id}`, data);
export const aprovarUsuario = (id) => api.put(`/auth/usuarios/${id}/aprovar`);
export const rejeitarUsuario = (id) => api.put(`/auth/usuarios/${id}/rejeitar`);
export const deleteUsuario = (id) => api.delete(`/auth/usuarios/${id}`);

// Organistas
export const getOrganistas = () => api.get('/organistas');
export const getOrganista = (id) => api.get(`/organistas/${id}`);
export const createOrganista = (data) => api.post('/organistas', data);
export const updateOrganista = (id, data) => api.put(`/organistas/${id}`, data);
export const deleteOrganista = (id) => api.delete(`/organistas/${id}`);

// Igrejas
export const getIgrejas = () => api.get('/igrejas');
export const getIgreja = (id) => api.get(`/igrejas/${id}`);
export const createIgreja = (data) => api.post('/igrejas', data);
export const updateIgreja = (id, data) => api.put(`/igrejas/${id}`, data);
export const deleteIgreja = (id) => api.delete(`/igrejas/${id}`);
export const getOrganistasIgreja = (id) => api.get(`/igrejas/${id}/organistas`);
export const addOrganistaIgreja = (igrejaId, organistaId) => 
  api.post(`/igrejas/${igrejaId}/organistas`, { organista_id: organistaId });
export const removeOrganistaIgreja = (igrejaId, organistaId) => 
  api.delete(`/igrejas/${igrejaId}/organistas/${organistaId}`);

// Cultos
export const getCultos = () => api.get('/cultos');
export const getCulto = (id) => api.get(`/cultos/${id}`);
export const getCultosIgreja = (igrejaId) => api.get(`/cultos/igreja/${igrejaId}`);
export const createCulto = (data) => api.post('/cultos', data);
export const updateCulto = (id, data) => api.put(`/cultos/${id}`, data);
export const deleteCulto = (id) => api.delete(`/cultos/${id}`);

// Rodízios
export const getRodizios = (params) => api.get('/rodizios', { params });
export const gerarRodizio = (igrejaId, periodoMeses, cicloInicial = null, dataInicial = null, organistaInicial = null) => 
  api.post('/rodizios/gerar', { 
    igreja_id: igrejaId, 
    periodo_meses: periodoMeses,
    ciclo_inicial: cicloInicial,
    data_inicial: dataInicial,
    organista_inicial: organistaInicial
  });
export const getRodizioPDF = (igrejaId, periodoInicio, periodoFim) => {
  const params = {};
  if (periodoInicio) params.periodo_inicio = periodoInicio;
  if (periodoFim) params.periodo_fim = periodoFim;
  return api.get(`/rodizios/pdf/${igrejaId}`, { params, responseType: 'blob' });
};
export const updateRodizio = (id, organistaId) => api.put(`/rodizios/${id}`, { organista_id: organistaId });
export const deleteRodizio = (id) => api.delete(`/rodizios/${id}`);
export const limparRodiziosIgreja = (igrejaId, periodoInicio, periodoFim) => {
  const params = {};
  if (periodoInicio) params.periodo_inicio = periodoInicio;
  if (periodoFim) params.periodo_fim = periodoFim;
  return api.delete(`/rodizios/igreja/${igrejaId}`, { params });
};
export const testarWebhook = () => api.post('/rodizios/testar-webhook');

// Notificações
export const getNotificacoes = () => api.get('/notificacoes');
export const enviarNotificacao = (rodizioId) => api.post(`/notificacoes/enviar/${rodizioId}`);

// Diagnóstico
export const getDiagnosticoIgreja = (igrejaId) => api.get(`/diagnostico/igreja/${igrejaId}`);
