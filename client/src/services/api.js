import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  // Evita “ficar salvando para sempre” quando o backend/proxy não responde.
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para adicionar token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
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
    // Erro de autenticação
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('igrejas');
      window.location.href = '/login';
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
export const register = (nome, email, senha, igreja) => api.post('/auth/register', { nome, email, senha, igreja });
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
