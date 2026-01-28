import React from 'react';
import LoadingSpinner from './LoadingSpinner';

/**
 * Componente de fallback para lazy loading
 * Substitui o loading básico por um spinner profissional
 */
function LazyLoadingFallback() {
  return <LoadingSpinner fullScreen message="Carregando página..." />;
}

export default LazyLoadingFallback;
