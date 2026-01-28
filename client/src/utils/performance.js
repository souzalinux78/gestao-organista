/**
 * Utilitário para métricas básicas de performance
 * Mede tempo de carregamento, renderização e interações
 */

/**
 * Mede tempo de carregamento de página
 */
export function measurePageLoad() {
  if (typeof window === 'undefined' || !window.performance) {
    return null;
  }

  const navigation = performance.getEntriesByType('navigation')[0];
  
  if (!navigation) {
    return null;
  }

  return {
    // Tempo total de carregamento
    loadTime: navigation.loadEventEnd - navigation.fetchStart,
    
    // Tempo até DOM estar pronto
    domReady: navigation.domContentLoadedEventEnd - navigation.fetchStart,
    
    // Tempo até primeiro byte
    ttfb: navigation.responseStart - navigation.fetchStart,
    
    // Tempo de download
    downloadTime: navigation.responseEnd - navigation.responseStart,
    
    // Tempo de DNS lookup
    dnsTime: navigation.domainLookupEnd - navigation.domainLookupStart,
    
    // Tempo de conexão
    connectTime: navigation.connectEnd - navigation.connectStart
  };
}

/**
 * Mede tempo de renderização de componente
 */
export function measureRender(componentName) {
  const startTime = performance.now();
  
  return () => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Performance] ${componentName} renderizado em ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  };
}

/**
 * Mede tempo de execução de função async
 */
export async function measureAsync(name, fn) {
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Performance] ${name} executado em ${duration.toFixed(2)}ms`);
    }
    
    return { result, duration };
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[Performance] ${name} falhou após ${duration.toFixed(2)}ms:`, error);
    }
    
    throw error;
  }
}

/**
 * Mede tempo de execução de função síncrona
 */
export function measureSync(name, fn) {
  const startTime = performance.now();
  
  try {
    const result = fn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Performance] ${name} executado em ${duration.toFixed(2)}ms`);
    }
    
    return { result, duration };
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[Performance] ${name} falhou após ${duration.toFixed(2)}ms:`, error);
    }
    
    throw error;
  }
}

/**
 * Obtém informações de memória (se disponível)
 */
export function getMemoryInfo() {
  if (typeof window === 'undefined' || !window.performance || !performance.memory) {
    return null;
  }

  const memory = performance.memory;
  
  return {
    used: (memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
    total: (memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
    limit: (memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
  };
}

/**
 * Log de métricas de performance na inicialização
 */
export function logInitialPerformance() {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') {
    return;
  }

  // Aguardar carregamento completo
  if (document.readyState === 'complete') {
    logMetrics();
  } else {
    window.addEventListener('load', logMetrics);
  }
}

function logMetrics() {
  const pageLoad = measurePageLoad();
  const memory = getMemoryInfo();
  
  console.group('📊 Métricas de Performance');
  
  if (pageLoad) {
    console.log('⏱️ Tempo de Carregamento:', {
      'Total': `${pageLoad.loadTime.toFixed(2)}ms`,
      'DOM Ready': `${pageLoad.domReady.toFixed(2)}ms`,
      'TTFB': `${pageLoad.ttfb.toFixed(2)}ms`,
      'Download': `${pageLoad.downloadTime.toFixed(2)}ms`
    });
  }
  
  if (memory) {
    console.log('💾 Memória:', memory);
  }
  
  // Informações de recursos
  const resources = performance.getEntriesByType('resource');
  const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
  console.log('📦 Tamanho Total de Recursos:', `${(totalSize / 1024).toFixed(2)} KB`);
  
  console.groupEnd();
}

export default {
  measurePageLoad,
  measureRender,
  measureAsync,
  measureSync,
  getMemoryInfo,
  logInitialPerformance
};
