// Service Worker - Network First Strategy (Sempre atualizado)
// Versão baseada em timestamp para forçar atualização
const CACHE_VERSION = new Date().getTime().toString();
const CACHE_NAME = `gestao-organistas-${CACHE_VERSION}`;

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
    }).then(() => {
      // Forçar ativação imediata
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
  const isStaticAsset = url.pathname.match(/\.(html|css|js|json)$/);
  
  // Para TODOS os arquivos, sempre buscar da rede primeiro (SEM CACHE)
  event.respondWith(
    fetch(event.request, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
      .then((response) => {
        // Se a requisição foi bem-sucedida, retornar resposta da rede
        if (response && response.status === 200) {
          // Criar uma nova resposta sem cache headers
          const newResponse = response.clone();
          return newResponse;
        }
        throw new Error('Network response was not ok');
      })
      .catch(() => {
        // Se a rede falhar, tentar buscar do cache como último recurso
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se não houver cache, retornar página offline básica
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
        });
      })
  );
});
