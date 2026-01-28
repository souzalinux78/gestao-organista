import React, { useState, useEffect } from 'react';
import './InstallPrompt.css';

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Verificar se foi dispensado recentemente PRIMEIRO
    const dismissed = localStorage.getItem('pwa-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      if (dismissedDate > new Date()) {
        console.log('[PWA] Prompt dispensado até:', dismissedDate);
        return; // Não mostrar se foi dispensado
      }
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // Verificar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('[PWA] App já está instalado (standalone mode)');
      setIsInstalled(true);
      return;
    }

    // Verificar se já foi instalado antes
    const installed = localStorage.getItem('pwa-installed');
    if (installed === 'true') {
      console.log('[PWA] App já foi instalado anteriormente');
      setIsInstalled(true);
      return;
    }

    // iOS não suporta beforeinstallprompt - mostrar instruções
    if (ios) {
      console.log('[PWA] iOS detectado - mostrando instruções');
      // Mostrar após 5 segundos para não ser intrusivo
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
      return;
    }

    // Aguardar evento beforeinstallprompt (Android/Chrome)
    const handler = (e) => {
      console.log('[PWA] beforeinstallprompt event recebido');
      e.preventDefault();
      setDeferredPrompt(e);
      // Mostrar prompt após 5 segundos (tempo suficiente para carregar a página)
      setTimeout(() => {
        console.log('[PWA] Mostrando prompt de instalação');
        setShowPrompt(true);
      }, 5000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Verificar se app foi instalado
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App instalado com sucesso');
      setIsInstalled(true);
      setShowPrompt(false);
      localStorage.setItem('pwa-installed', 'true');
    });

    // Fallback: Se após 10 segundos não recebeu beforeinstallprompt, 
    // pode ser que o navegador não suporte ou já tenha sido instalado
    // Mas não vamos mostrar nada neste caso para evitar spam

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('[PWA] deferredPrompt não disponível');
      return;
    }

    try {
      // Mostrar prompt de instalação
      await deferredPrompt.prompt();

      // Aguardar resposta do usuário
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('[PWA] Usuário aceitou instalação');
        setIsInstalled(true);
        localStorage.setItem('pwa-installed', 'true');
      } else {
        console.log('[PWA] Usuário rejeitou instalação');
      }

      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('[PWA] Erro ao mostrar prompt:', error);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    console.log('[PWA] Prompt dispensado pelo usuário');
    setShowPrompt(false);
    // Não mostrar novamente por 7 dias
    const dismissUntil = new Date();
    dismissUntil.setDate(dismissUntil.getDate() + 7);
    localStorage.setItem('pwa-dismissed', dismissUntil.toISOString());
  };

  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <div className="install-prompt-header">
          <div className="install-prompt-icon">
            <span>📱</span>
          </div>
          <div className="install-prompt-title-section">
            <h3 className="install-prompt-title">📲 Instalar no Celular</h3>
            <p className="install-prompt-subtitle">
              {isIOS ? (
                <>
                  <div className="instruction-step">
                    <strong>1️⃣</strong> Toque no botão <strong>"Compartilhar"</strong> (ícone quadrado com seta) na parte inferior da tela
                  </div>
                  <div className="instruction-step">
                    <strong>2️⃣</strong> Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>
                  </div>
                  <div className="instruction-step">
                    <strong>3️⃣</strong> Toque em <strong>"Adicionar"</strong> para confirmar
                  </div>
                </>
              ) : (
                <>
                  <strong>Instale este app no seu celular!</strong><br/>
                  Assim você terá acesso rápido direto da tela inicial,<br/>
                  <strong>sem precisar abrir o navegador toda vez.</strong>
                </>
              )}
            </p>
          </div>
          <button 
            className="btn-dismiss"
            onClick={handleDismiss}
            aria-label="Fechar"
            title="Fechar"
          >
            ✕
          </button>
        </div>
        
        <div className="install-prompt-benefits">
          <div className="benefit-item">
            <span className="benefit-icon">⚡</span>
            <span>Acesso rápido</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">📴</span>
            <span>Funciona offline</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">🔔</span>
            <span>Notificações</span>
          </div>
        </div>

        {!isIOS && (
          <button 
            className="btn-install-primary"
            onClick={handleInstallClick}
          >
            <span className="btn-icon">⬇️</span>
            <span>Instalar Agora</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default InstallPrompt;
