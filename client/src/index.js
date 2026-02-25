import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/theme.css';
import './styles/app-ui.css';
import App from './App';
import { logInitialPerformance } from './utils/performance';

// Force light theme (dark mode disabled)
try {
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.setItem('app-theme', 'light');
} catch (e) {
  // no-op
}

if (process.env.NODE_ENV !== 'production') {
  logInitialPerformance();
}

// Hard-disable old PWA runtime to avoid auto refresh loops on mobile/login.
async function disableLegacyPwaRuntime() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      const appCaches = cacheNames.filter((name) =>
        name.startsWith('gestao-organistas-') || name === 'gestao-organistas-static-v1'
      );
      await Promise.all(appCaches.map((name) => caches.delete(name)));
    }
  } catch (error) {
    console.warn('[BOOT] Failed to clear legacy PWA runtime:', error);
  }
}

window.addEventListener('load', () => {
  disableLegacyPwaRuntime();
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
