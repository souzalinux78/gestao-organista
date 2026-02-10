import React from 'react';
import './LoadingSpinner.css';

/**
 * Componente de Loading Reutilizável
 * Feedback visual consistente para operações assíncronas
 */
function LoadingSpinner({ size = 'medium', message = null, fullScreen = false }) {
  const sizeClass = `spinner--${size}`;
  const containerClass = fullScreen ? 'loading-spinner-fullscreen' : 'loading-spinner-inline';

  return (
    <div className={containerClass}>
      <div className={`spinner ${sizeClass}`}>
        <div className="spinner__ring"></div>
        <div className="spinner__ring"></div>
        <div className="spinner__ring"></div>
      </div>
      {message && <p className="loading-spinner__message">{message}</p>}
    </div>
  );
}

export default LoadingSpinner;
