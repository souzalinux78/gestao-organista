// Service Worker - Cache Control e AtualizaÃ§Ã£o Controlada
// VersÃ£o estÃ¡tica baseada no build (nÃ£o timestamp dinÃ¢mico)
// Evita loops de reload e garante atualizaÃ§Ãµes controladas
//
// IMPORTANTE: Para atualizar o Service Worker em produÃ§Ã£o:
// 1. Alterar CACHE_VERSION abaixo (ex: 'v1.0.1', 'v1.1.0', etc.)
// 2. Alterar a mesma versÃ£o em client/src/index.js (const swVersion)
// 3. Fazer build e deploy
// 4. O Service Worker serÃ¡ atualizado na prÃ³xima visita do usuÃ¡rio (sem reload automÃ¡tico)
//
const CACHE_VERSION = 'v1.0.1'; // VersÃ£o estÃ¡tica - alterar apenas em novos builds
const CACHE_NAME = `gestao-organistas-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = 'gestao-organistas-static-v1';

const OFFLINE_URL = '/offline.html';

// Instalar Service Worker - SEM forÃ§ar ativaÃ§Ã£o imediata
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker - VersÃ£o:', CACHE_VERSION);
  
  // NÃƒO forÃ§ar skipWaiting - aguardar atÃ© que todas as pÃ¡ginas sejam fechadas
  // Isso evita reloads automÃ¡ticos em loop
  event.waitUntil(
    // Limpar apenas caches antigos (nÃ£o o cache atual se jÃ¡ existir)
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Remover apenas caches de versÃµes antigas
          if (cacheName.startsWith('gestao-organistas-') && cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(async () => {
      // Cache SOMENTE offline page
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.addAll([OFFLINE_URL]);
      } catch (err) {
        console.log('[SW] Erro ao cachear offline page:', err);
      }
      
      // Assets estÃ¡ticos serÃ£o cacheados sob demanda
      const staticCache = await caches.open(STATIC_CACHE_NAME);
      console.log('[SW] Service Worker instalado - VersÃ£o:', CACHE_VERSION);
    })
  );
  
  // NÃƒO chamar skipWaiting() aqui - deixar o Service Worker aguardar
});

// Ativar Service Worker - SEM forÃ§ar controle imediato
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker - VersÃ£o:', CACHE_VERSION);
  
  event.waitUntil(
    // Limpar apenas caches antigos
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Remover apenas caches de versÃµes antigas
          if (cacheName.startsWith('gestao-organistas-') && cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // NÃƒO forÃ§ar clients.claim() - deixar o Service Worker assumir controle naturalmente
      // Isso evita reloads automÃ¡ticos
      console.log('[SW] Service Worker ativado - VersÃ£o:', CACHE_VERSION);
      return Promise.resolve();
    })
  );
});

// Interceptar requisiÃ§Ãµes - Network First (Sempre buscar versÃ£o atual)
self.addEventListener('fetch', (event) => {
  // Ignorar requisiÃ§Ãµes que nÃ£o sÃ£o GET
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
          // NÃƒO cachear HTML - sempre buscar da rede
          return response;
        })
        .catch(() => {
          // Se a rede falhar, mostrar offline page
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // EstratÃ©gia: Cache First para assets estÃ¡ticos (JS, CSS, imagens, fonts)
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
          // Se nÃ£o estiver no cache, buscar da rede e cachear
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
        // NÃƒO cachear - sempre da rede
        return response;
      })
      .catch(() => {
        // Se a rede falhar, tentar buscar do cache (fallback)
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Se for uma requisiÃ§Ã£o de documento e nÃ£o houver cache, mostrar offline page
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


