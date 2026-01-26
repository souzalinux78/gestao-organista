import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Sistema de atualização automática - FORÇA sempre a última versão
let appVersion = null;
let checkVersionInterval = null;

// Função para verificar versão do app
async function checkAppVersion() {
  try {
    // Buscar index.html com timestamp para forçar atualização
    const response = await fetch(`/index.html?t=${Date.now()}`, {
      cache: 'no-store',
      method: 'HEAD'
    });
    
    // Verificar se há nova versão comparando headers
    const lastModified = response.headers.get('last-modified');
    const etag = response.headers.get('etag');
    
    if (appVersion && (lastModified !== appVersion.lastModified || etag !== appVersion.etag)) {
      console.log('[UPDATE] Nova versão detectada! Recarregando...');
      // Limpar todos os caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // Recarregar página
      window.location.reload(true);
      return;
    }
    
    appVersion = { lastModified, etag };
  } catch (error) {
    console.error('[UPDATE] Erro ao verificar versão:', error);
  }
}

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
            }, 15000); // A cada 15 segundos
            
            // Verificar versão do app a cada 10 segundos
            checkVersionInterval = setInterval(() => {
              checkAppVersion();
            }, 10000);
            
            // Verificar versão quando a página ganha foco
            window.addEventListener('focus', () => {
              registration.update();
              checkAppVersion();
            });
            
            // Verificar versão quando a página fica visível
            document.addEventListener('visibilitychange', () => {
              if (!document.hidden) {
                registration.update();
                checkAppVersion();
              }
            });
            
            // Escutar atualizações do service worker
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Novo service worker disponível - recarregar página
                  console.log('[PWA] Nova versão disponível. Recarregando...');
                  // Limpar caches antes de recarregar
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      Promise.all(names.map(name => caches.delete(name))).then(() => {
                        window.location.reload(true);
                      });
                    });
                  } else {
                    window.location.reload(true);
                  }
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
      // Limpar caches antes de recarregar
      if ('caches' in window) {
        caches.keys().then(names => {
          Promise.all(names.map(name => caches.delete(name))).then(() => {
            window.location.reload(true);
          });
        });
      } else {
        window.location.reload(true);
      }
    }
  });
  
  // Forçar atualização ao carregar a página
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Verificar versão na inicialização
checkAppVersion();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
