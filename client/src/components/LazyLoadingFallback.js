import React from 'react';
import LoadingSpinner from './LoadingSpinner';

function LazyLoadingFallback() {
  return <LoadingSpinner fullScreen message="Carregando sistema..." />;
}

export default LazyLoadingFallback;
