// Service Worker - Estratégia Híbrida (Network First + Cache First)
// Cache version dinâmico baseado em timestamp do build
// A versão será atualizada automaticamente em novos deploys
const CACHE_VERSION = 'v' + new Date().getTime();
const CACHE_NAME = `gestao-organistas-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = 'gestao-organistas-static-v1';

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
      // Cache de páginas (HTML)
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll([OFFLINE_URL, '/']);
      
      // Cache de assets estáticos (JS, CSS, imagens, fonts)
      const staticCache = await caches.open(STATIC_CACHE_NAME);
      // Assets serão cacheados sob demanda na primeira requisição
      
      // Não forçar ativação imediata - evitar reloads desnecessários
      // return self.skipWaiting();
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
          // Remover todos os caches antigos (exceto static cache e cache atual)
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Não forçar claim imediato - evitar reloads desnecessários
      // return self.clients.claim();
      return Promise.resolve();
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
            fetch(event.request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const staticCache = caches.open(STATIC_CACHE_NAME);
                staticCache.then(cache => cache.put(event.request, networkResponse.clone()));
              }
            }).catch(() => {});
            return cachedResponse;
          }
          // Se não estiver no cache, buscar da rede e cachear
          return fetch(event.request)
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

  // Estratégia: Network First para HTML e outros recursos
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        if (response && response.status === 200) {
          // Cachear resposta HTML válida
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        }
        throw new Error('Network response was not ok');
      })
      .catch(() => {
        // Se a rede falhar, tentar buscar do cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Se for uma requisição de documento e não houver cache, mostrar offline page
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
