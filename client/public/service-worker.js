// Service Worker - Network First Strategy (Sempre atualizado)
const CACHE_VERSION = Date.now().toString();
const CACHE_NAME = `gestao-organistas-${CACHE_VERSION}`;

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker - Versão:', CACHE_VERSION);
  self.skipWaiting(); // Ativar imediatamente
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

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a requisição foi bem-sucedida, retornar resposta da rede
        if (response && response.status === 200) {
          return response;
        }
        throw new Error('Network response was not ok');
      })
      .catch(() => {
        // Se a rede falhar, tentar buscar do cache como fallback
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
