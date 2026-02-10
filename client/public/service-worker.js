// Service Worker - Cache Control e Atualização Controlada
// Versão estática baseada no build (não timestamp dinâmico)
// Evita loops de reload e garante atualizações controladas
//
// IMPORTANTE: Para atualizar o Service Worker em produção:
// 1. Alterar CACHE_VERSION abaixo (ex: 'v1.0.1', 'v1.1.0', etc.)
// 2. Alterar a mesma versão em client/src/index.js (const swVersion)
// 3. Fazer build e deploy
// 4. O Service Worker será atualizado na próxima visita do usuário (sem reload automático)
//
const CACHE_VERSION = 'v1.0.0'; // Versão estática - alterar apenas em novos builds
const CACHE_NAME = `gestao-organistas-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = 'gestao-organistas-static-v1';

const OFFLINE_URL = '/offline.html';

// Instalar Service Worker - SEM forçar ativação imediata
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker - Versão:', CACHE_VERSION);
  
  // NÃO forçar skipWaiting - aguardar até que todas as páginas sejam fechadas
  // Isso evita reloads automáticos em loop
  event.waitUntil(
    // Limpar apenas caches antigos (não o cache atual se já existir)
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Remover apenas caches de versões antigas
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
      
      // Assets estáticos serão cacheados sob demanda
      const staticCache = await caches.open(STATIC_CACHE_NAME);
      console.log('[SW] Service Worker instalado - Versão:', CACHE_VERSION);
    })
  );
  
  // NÃO chamar skipWaiting() aqui - deixar o Service Worker aguardar
});

// Ativar Service Worker - SEM forçar controle imediato
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker - Versão:', CACHE_VERSION);
  
  event.waitUntil(
    // Limpar apenas caches antigos
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Remover apenas caches de versões antigas
          if (cacheName.startsWith('gestao-organistas-') && cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // NÃO forçar clients.claim() - deixar o Service Worker assumir controle naturalmente
      // Isso evita reloads automáticos
      console.log('[SW] Service Worker ativado - Versão:', CACHE_VERSION);
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
