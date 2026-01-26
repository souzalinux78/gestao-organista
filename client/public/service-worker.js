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
    })
  );
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

  // Para HTML, CSS e JS, sempre buscar da rede primeiro (sem cache)
  const url = new URL(event.request.url);
  const isStaticAsset = url.pathname.match(/\.(html|css|js|json)$/);
  
  if (isStaticAsset) {
    // Para arquivos estáticos, sempre buscar da rede e ignorar cache
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
          return caches.match(event.request);
        })
    );
  } else {
    // Para outros recursos (imagens, etc), usar network first
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200) {
            return response;
          }
          throw new Error('Network response was not ok');
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});
