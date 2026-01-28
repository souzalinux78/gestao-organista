import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/theme.css'; // Importar theme.css DEPOIS de index.css para sobrescrever variáveis
import App from './App';
import { logInitialPerformance } from './utils/performance';

// Log de métricas de performance (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  logInitialPerformance();
}

// Sistema de atualização automática - DESABILITADO para evitar loops infinitos
// DESABILITADO COMPLETAMENTE - pode ser reativado se necessário com melhorias
const AUTO_UPDATE_ENABLED = false; // Desabilitado para evitar reloads infinitos

let appVersion = null;
let checkVersionInterval = null;
let isReloading = false;
let reloadAttempts = 0;
const MAX_RELOAD_ATTEMPTS = 2; // Reduzido para 2

// Detectar se é mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Verificar se foi refresh manual (não verificar versão após refresh manual)
const wasManualRefresh = sessionStorage.getItem('manual-refresh') === 'true';
if (wasManualRefresh) {
  sessionStorage.removeItem('manual-refresh');
}

// Detectar refresh manual
window.addEventListener('beforeunload', () => {
  sessionStorage.setItem('manual-refresh', 'true');
});

// Função para verificar versão do app (DESABILITADA para evitar loops)
async function checkAppVersion() {
  // DESABILITAR completamente se AUTO_UPDATE_ENABLED for false
  if (!AUTO_UPDATE_ENABLED) {
    return;
  }
  
  // DESABILITAR completamente no mobile após refresh manual
  if (isMobile && wasManualRefresh) {
    console.log('[UPDATE] Verificação desabilitada no mobile após refresh manual');
    return;
  }
  
  // Prevenir loops infinitos
  if (isReloading || reloadAttempts >= MAX_RELOAD_ATTEMPTS) {
    if (checkVersionInterval) {
      clearInterval(checkVersionInterval);
      checkVersionInterval = null;
    }
    return;
  }

  // No mobile, verificar apenas uma vez após 30 segundos (não periodicamente)
  if (isMobile && appVersion !== null) {
    return; // Já verificou uma vez, não verificar mais no mobile
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
    
    // Se já tiver versão salva, comparar
    if (appVersion) {
      // Só recarregar se realmente houver mudança E não estiver em loop
      if ((lastModified !== appVersion.lastModified || etag !== appVersion.etag) &&
          !isReloading) {
        console.log('[UPDATE] Nova versão detectada! Recarregando...');
        isReloading = true;
        reloadAttempts++;
        
        // No mobile, NÃO recarregar automaticamente após refresh manual
        if (isMobile && wasManualRefresh) {
          console.log('[UPDATE] Refresh manual detectado no mobile. Não recarregando automaticamente.');
          isReloading = false;
          reloadAttempts = 0;
          return;
        }
        
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
          if (reloadAttempts < MAX_RELOAD_ATTEMPTS && !wasManualRefresh) {
            window.location.reload();
          } else {
            console.warn('[UPDATE] Muitas tentativas de reload ou refresh manual. Parando verificação.');
            if (checkVersionInterval) {
              clearInterval(checkVersionInterval);
              checkVersionInterval = null;
            }
            isReloading = false;
          }
        }, 3000); // Aumentar delay para 3 segundos
        return;
      }
      
      // Resetar contador se não houver mudança
      if (lastModified === appVersion.lastModified && etag === appVersion.etag) {
        reloadAttempts = 0;
      }
    }
    
    // Salvar versão atual (apenas uma vez no mobile)
    appVersion = { lastModified, etag };
  } catch (error) {
    // Erro silencioso - não fazer reload em caso de erro de rede
    console.error('[UPDATE] Erro ao verificar versão:', error);
  }
}

// Registrar Service Worker para PWA - SEM loops infinitos no mobile
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Verificar se já está em modo standalone (PWA instalado)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // No mobile, usar versão fixa do SW (não baseada em timestamp)
    const swVersion = isMobile ? 'v1' : Date.now().toString();
    
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
        navigator.serviceWorker.register(`/service-worker.js?${swVersion}`, {
          updateViaCache: 'none'
        })
          .then((registration) => {
            console.log('[PWA] Service Worker registrado:', registration.scope);
            
            // DESABILITAR verificação automática se AUTO_UPDATE_ENABLED for false
            if (AUTO_UPDATE_ENABLED && (!isMobile || !wasManualRefresh)) {
              // Verificar atualizações apenas periodicamente (não imediatamente)
              setInterval(() => {
                if (!wasManualRefresh) {
                  registration.update();
                }
              }, 300000); // A cada 5 minutos (muito menos agressivo)
              
              // Verificar versão do app apenas no desktop ou se não foi refresh manual
              if (!isMobile) {
                checkVersionInterval = setInterval(() => {
                  if (!isReloading && reloadAttempts < MAX_RELOAD_ATTEMPTS && !wasManualRefresh) {
                    checkAppVersion();
                  }
                }, 600000); // A cada 10 minutos (muito menos agressivo)
              }
            }
            
            // Verificar versão quando a página ganha foco (apenas no desktop e se habilitado)
            if (AUTO_UPDATE_ENABLED && !isMobile) {
              let focusChecked = false;
              window.addEventListener('focus', () => {
                if (!focusChecked && !isReloading && !wasManualRefresh) {
                  focusChecked = true;
                  registration.update();
                  setTimeout(() => {
                    checkAppVersion();
                    focusChecked = false;
                  }, 10000); // Aguardar 10 segundos antes de permitir nova verificação
                }
              });
            }
            
            // Escutar atualizações do service worker (com proteção - DESABILITADO se AUTO_UPDATE_ENABLED for false)
            if (AUTO_UPDATE_ENABLED) {
              registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                
                // No mobile após refresh manual, não recarregar automaticamente
                if (isMobile && wasManualRefresh) {
                  console.log('[PWA] Atualização do SW detectada, mas refresh manual no mobile. Não recarregando.');
                  return;
                }
                
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && 
                      navigator.serviceWorker.controller && 
                      !isReloading &&
                      reloadAttempts < MAX_RELOAD_ATTEMPTS &&
                      !(isMobile && wasManualRefresh)) {
                    console.log('[PWA] Nova versão disponível. Recarregando...');
                    isReloading = true;
                    reloadAttempts++;
                    
                    // Limpar caches antes de recarregar
                    if ('caches' in window) {
                      caches.keys().then(names => {
                        Promise.all(names.map(name => caches.delete(name))).then(() => {
                          setTimeout(() => {
                            window.location.reload();
                          }, 2000);
                        });
                      });
                    } else {
                      setTimeout(() => {
                        window.location.reload();
                      }, 2000);
                    }
                  }
                });
              });
            }
          })
          .catch((error) => {
            console.error('[PWA] Falha ao registrar Service Worker:', error);
          });
      }, 1000); // Aumentar delay para evitar conflitos
    });
  });
  
  // Escutar mensagens do service worker (com proteção - DESABILITADO se AUTO_UPDATE_ENABLED for false)
  if (AUTO_UPDATE_ENABLED) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SKIP_WAITING' && 
          !isReloading && 
          reloadAttempts < MAX_RELOAD_ATTEMPTS &&
          !(isMobile && wasManualRefresh)) {
        isReloading = true;
        reloadAttempts++;
        
        if ('caches' in window) {
          caches.keys().then(names => {
            Promise.all(names.map(name => caches.delete(name))).then(() => {
              setTimeout(() => {
                window.location.reload();
              }, 2000);
            });
          });
        } else {
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      }
    });
  }
}

// Verificar versão na inicialização (apenas se AUTO_UPDATE_ENABLED for true)
if (AUTO_UPDATE_ENABLED && (!isMobile || !wasManualRefresh)) {
  setTimeout(() => {
    if (!isReloading) {
      checkAppVersion();
    }
  }, 5000); // Aguardar 5 segundos após carregar
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
