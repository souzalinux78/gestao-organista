import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Registrar Service Worker para PWA - Sempre atualizado
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Desregistrar service workers antigos primeiro
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister();
        console.log('[PWA] Service Worker antigo desregistrado');
      }
      
      // Aguardar um pouco antes de registrar o novo
      setTimeout(() => {
        navigator.serviceWorker.register('/service-worker.js?' + Date.now(), {
          updateViaCache: 'none' // Nunca usar cache do service worker
        })
          .then((registration) => {
            console.log('[PWA] Service Worker registrado:', registration.scope);
            
            // Verificar atualizações imediatamente e periodicamente
            registration.update();
            setInterval(() => {
              registration.update();
            }, 30000); // A cada 30 segundos
            
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
                  window.location.reload(true);
                }
              });
            });
          })
          .catch((error) => {
            console.error('[PWA] Falha ao registrar Service Worker:', error);
          });
      }, 100);
    });
  });
  
  // Escutar mensagens do service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      window.location.reload(true);
    }
  });
  
  // Forçar atualização ao carregar a página
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
