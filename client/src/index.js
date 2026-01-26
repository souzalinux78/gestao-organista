import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Sistema de atualização automática - SEM loops infinitos
let appVersion = null;
let checkVersionInterval = null;
let isReloading = false;
let reloadAttempts = 0;
const MAX_RELOAD_ATTEMPTS = 3;

// Função para verificar versão do app (com proteção contra loops)
async function checkAppVersion() {
  // Prevenir loops infinitos
  if (isReloading || reloadAttempts >= MAX_RELOAD_ATTEMPTS) {
    return;
  }

  try {
    // Buscar index.html com timestamp para forçar atualização
    const response = await fetch(`/index.html?t=${Date.now()}`, {
      cache: 'no-store',
      method: 'HEAD'
    });
    
    if (!response.ok) {
      return; // Se não conseguir verificar, não fazer nada
    }
    
    // Verificar se há nova versão comparando headers
    const lastModified = response.headers.get('last-modified');
    const etag = response.headers.get('etag');
    
    // Só recarregar se realmente houver mudança E não estiver em loop
    if (appVersion && 
        (lastModified !== appVersion.lastModified || etag !== appVersion.etag) &&
        !isReloading) {
      console.log('[UPDATE] Nova versão detectada! Recarregando...');
      isReloading = true;
      reloadAttempts++;
      
      // Limpar todos os caches
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        } catch (e) {
          console.error('[UPDATE] Erro ao limpar caches:', e);
        }
      }
      
      // Aguardar um pouco antes de recarregar para evitar loops
      setTimeout(() => {
        if (reloadAttempts < MAX_RELOAD_ATTEMPTS) {
          window.location.reload();
        } else {
          console.warn('[UPDATE] Muitas tentativas de reload. Parando verificação automática.');
          if (checkVersionInterval) {
            clearInterval(checkVersionInterval);
          }
          isReloading = false;
        }
      }, 2000);
      return;
    }
    
    // Resetar contador se não houver mudança
    if (appVersion && lastModified === appVersion.lastModified && etag === appVersion.etag) {
      reloadAttempts = 0;
    }
    
    appVersion = { lastModified, etag };
  } catch (error) {
    // Erro silencioso - não fazer reload em caso de erro de rede
    console.error('[UPDATE] Erro ao verificar versão:', error);
  }
}

// Registrar Service Worker para PWA - SEM loops infinitos
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Verificar se já está em modo standalone (PWA instalado)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      // Não desregistrar service workers se já estiver instalado como PWA
      if (!isStandalone && registrations.length > 0) {
        // Limpar apenas se houver múltiplos registros
        if (registrations.length > 1) {
          for (let i = 1; i < registrations.length; i++) {
            registrations[i].unregister();
          }
        }
      }
      
      // Aguardar um pouco antes de registrar o novo
      setTimeout(() => {
        navigator.serviceWorker.register('/service-worker.js?' + Date.now(), {
          updateViaCache: 'none'
        })
          .then((registration) => {
            console.log('[PWA] Service Worker registrado:', registration.scope);
            
            // Verificar atualizações apenas periodicamente (não imediatamente)
            setInterval(() => {
              registration.update();
            }, 60000); // A cada 1 minuto (menos agressivo)
            
            // Verificar versão do app apenas a cada 5 minutos (muito menos agressivo)
            checkVersionInterval = setInterval(() => {
              if (!isReloading && reloadAttempts < MAX_RELOAD_ATTEMPTS) {
                checkAppVersion();
              }
            }, 300000); // A cada 5 minutos
            
            // Verificar versão quando a página ganha foco (apenas uma vez)
            let focusChecked = false;
            window.addEventListener('focus', () => {
              if (!focusChecked && !isReloading) {
                focusChecked = true;
                registration.update();
                setTimeout(() => {
                  checkAppVersion();
                  focusChecked = false;
                }, 5000); // Aguardar 5 segundos antes de permitir nova verificação
              }
            });
            
            // Escutar atualizações do service worker (com proteção)
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (!newWorker) return;
              
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && 
                    navigator.serviceWorker.controller && 
                    !isReloading &&
                    reloadAttempts < MAX_RELOAD_ATTEMPTS) {
                  console.log('[PWA] Nova versão disponível. Recarregando...');
                  isReloading = true;
                  reloadAttempts++;
                  
                  // Limpar caches antes de recarregar
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      Promise.all(names.map(name => caches.delete(name))).then(() => {
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
                      });
                    });
                  } else {
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                  }
                }
              });
            });
          })
          .catch((error) => {
            console.error('[PWA] Falha ao registrar Service Worker:', error);
          });
      }, 500); // Aumentar delay para evitar conflitos
    });
  });
  
  // Escutar mensagens do service worker (com proteção)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING' && !isReloading && reloadAttempts < MAX_RELOAD_ATTEMPTS) {
      isReloading = true;
      reloadAttempts++;
      
      if ('caches' in window) {
        caches.keys().then(names => {
          Promise.all(names.map(name => caches.delete(name))).then(() => {
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          });
        });
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    }
  });
}

// Verificar versão na inicialização (apenas uma vez, com delay)
setTimeout(() => {
  if (!isReloading) {
    checkAppVersion();
  }
}, 3000); // Aguardar 3 segundos após carregar

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
