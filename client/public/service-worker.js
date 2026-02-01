// Service Worker - Atualização Forçada e Cache Control
// Versão dinâmica baseada em timestamp do build
// SEMPRE força atualização e limpa caches antigos
const CACHE_VERSION = 'v' + Date.now();
const CACHE_NAME = `gestao-organistas-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = 'gestao-organistas-static-v1';

const OFFLINE_URL = '/offline.html';

// Instalar Service Worker - FORÇAR ATIVAÇÃO IMEDIATA
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker - Versão:', CACHE_VERSION);
  
  // FORÇAR skipWaiting para ativar imediatamente
  self.skipWaiting();
  
  event.waitUntil(
    // Limpar TODOS os caches antigos imediatamente
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[SW] Removendo cache antigo:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(async () => {
      // Cache SOMENTE offline page
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll([OFFLINE_URL]);
      
      // Assets estáticos serão cacheados sob demanda
      const staticCache = await caches.open(STATIC_CACHE_NAME);
      console.log('[SW] Cache limpo e preparado');
    })
  );
});

// Ativar Service Worker - FORÇAR CONTROLE IMEDIATO
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker - Versão:', CACHE_VERSION);
  
  event.waitUntil(
    // Limpar TODOS os caches antigos
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Remover TODOS os caches antigos (exceto cache atual)
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // FORÇAR clients.claim() para controlar todas as páginas imediatamente
      return self.clients.claim();
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

  // NUNCA interceptar chamadas da API - sempre da rede
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // HTML NUNCA deve ser cacheado - sempre da rede
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          // NÃO cachear HTML - sempre buscar da rede
          return response;
        })
        .catch(() => {
          // Se a rede falhar, mostrar offline page
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Estratégia: Cache First para assets estáticos (JS, CSS, imagens, fonts)
  const isStaticAsset = 
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i) ||
    url.pathname.startsWith('/static/');

  if (isStaticAsset) {
    // Cache First: Buscar do cache primeiro, depois da rede
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Atualizar cache em background (stale-while-revalidate)
            fetch(event.request, { cache: 'reload' }).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const staticCache = caches.open(STATIC_CACHE_NAME);
                staticCache.then(cache => cache.put(event.request, networkResponse.clone()));
              }
            }).catch(() => {});
            return cachedResponse;
          }
          // Se não estiver no cache, buscar da rede e cachear
          return fetch(event.request, { cache: 'reload' })
            .then((response) => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(STATIC_CACHE_NAME).then(cache => {
                  cache.put(event.request, responseToCache);
                });
              }
              return response;
            })
            .catch(() => {
              // Se falhar, retornar resposta vazia
              return new Response('', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
    return;
  }

  // Para outros recursos: Network First (sempre da rede)
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        // NÃO cachear - sempre da rede
        return response;
      })
      .catch(() => {
        // Se a rede falhar, tentar buscar do cache (fallback)
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Se for uma requisição de documento e não houver cache, mostrar offline page
            if (event.request.destination === 'document') {
              return caches.match(OFFLINE_URL);
            }
            return new Response('', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});
