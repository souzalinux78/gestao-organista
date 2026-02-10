import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

function Modal({ isOpen, title, onClose, children }) {
  const scrollStateRef = useRef({
    scrollY: 0,
    position: '',
    top: '',
    width: '',
    overflow: ''
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    const { style } = document.body;
    scrollStateRef.current = {
      scrollY: window.scrollY,
      position: style.position,
      top: style.top,
      width: style.width,
      overflow: style.overflow
    };
    style.position = 'fixed';
    style.top = `-${scrollStateRef.current.scrollY}px`;
    style.width = '100%';
    style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      style.position = scrollStateRef.current.position;
      style.top = scrollStateRef.current.top;
      style.width = scrollStateRef.current.width;
      style.overflow = scrollStateRef.current.overflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.scrollTo(0, scrollStateRef.current.scrollY);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="btn btn-secondary modal-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
