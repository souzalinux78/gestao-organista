import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Registrar Service Worker para PWA - Sempre atualizado
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', {
      updateViaCache: 'none' // Nunca usar cache do service worker
    })
      .then((registration) => {
        console.log('[PWA] Service Worker registrado:', registration.scope);
        
        // Verificar atualizações periodicamente
        setInterval(() => {
          registration.update();
        }, 60000); // A cada 1 minuto
        
        // Forçar atualização quando a página ganha foco
        window.addEventListener('focus', () => {
          registration.update();
        });
        
        // Escutar atualizações do service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Novo service worker disponível - recarregar página
              console.log('[PWA] Nova versão disponível. Recarregando...');
              window.location.reload();
            }
          });
        });
      })
      .catch((error) => {
        console.error('[PWA] Falha ao registrar Service Worker:', error);
      });
  });
  
  // Escutar mensagens do service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      window.location.reload();
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
