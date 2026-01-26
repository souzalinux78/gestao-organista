// Service Worker - Network First Strategy (Sempre atualizado)
// Versão baseada em timestamp para forçar atualização
const CACHE_VERSION = new Date().getTime().toString();
const CACHE_NAME = `gestao-organistas-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline.html';

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker - Versão:', CACHE_VERSION);
  // Limpar todos os caches antigos imediatamente
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[SW] Removendo cache antigo:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll([OFFLINE_URL, '/']);
      return self.skipWaiting();
    })
  );
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker - Versão:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Remover todos os caches antigos
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Controlar todas as páginas imediatamente
    })
  );
});

// Interceptar requisições - Network First (Sempre buscar versão atual)
self.addEventListener('fetch', (event) => {
  // Ignorar requisições que não são GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Nunca interceptar chamadas da API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para todos os arquivos, sempre buscar da rede primeiro (SEM CACHE)
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        if (response && response.status === 200) {
          return response;
        }
        throw new Error('Network response was not ok');
      })
      .catch(() => {
        // Se a rede falhar, tentar buscar do cache como último recurso
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            if (event.request.destination === 'document') {
              return caches.match(OFFLINE_URL);
            }
            return null;
          })
          .then((fallbackResponse) => {
            if (fallbackResponse) {
              return fallbackResponse;
            }
            // Garantir sempre uma Response válida
            return new Response('', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});
