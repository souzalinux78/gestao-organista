import React, { useEffect } from 'react';
import './Toast.css';

/**
 * Componente Toast/Notification Reutilizável
 * Substitui os alerts inline por notificações elegantes
 */
function Toast({ message, type = 'success', onClose, duration = 5000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!message) return null;

  return (
    <div className={`toast toast--${type}`} role="alert">
      <div className="toast__content">
        <span className="toast__icon">
          {type === 'success' && '✓'}
          {type === 'error' && '✕'}
          {type === 'warning' && '⚠'}
          {type === 'info' && 'ℹ'}
        </span>
        <span className="toast__message">{message}</span>
      </div>
      <button 
        className="toast__close" 
        onClick={onClose}
        aria-label="Fechar notificação"
      >
        ×
      </button>
    </div>
  );
}

export default Toast;
