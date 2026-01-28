/**
 * Hook para gerenciar tema dark/light
 * Detecta preferência do sistema e salva escolha do usuário
 */

import { useState, useEffect } from 'react';

const THEME_STORAGE_KEY = 'app-theme';

/**
 * Detecta a preferência de tema do sistema
 */
function getSystemTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * Obtém o tema salvo ou detecta do sistema
 */
function getInitialTheme() {
  // Verificar se há tema salvo no localStorage
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme;
  }
  
  // Se não houver tema salvo, usar preferência do sistema
  return getSystemTheme();
}

/**
 * Aplica o tema ao documento
 */
function applyTheme(theme) {
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
  }
}

/**
 * Hook useTheme
 * @returns {Object} { theme, toggleTheme, setTheme }
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    // Inicializar com tema salvo ou do sistema
    const initialTheme = getInitialTheme();
    // Aplicar imediatamente para evitar flash
    if (typeof document !== 'undefined') {
      applyTheme(initialTheme);
    }
    return initialTheme;
  });

  // Aplicar tema quando mudar
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Ouvir mudanças na preferência do sistema (se não houver tema salvo)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      // Só atualizar se não houver tema salvo manualmente
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (!savedTheme) {
        const newTheme = e.matches ? 'dark' : 'light';
        setThemeState(newTheme);
      }
    };

    // Adicionar listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback para navegadores antigos
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  /**
   * Alterna entre dark e light
   */
  const toggleTheme = () => {
    setThemeState(prevTheme => {
      const newTheme = prevTheme === 'dark' ? 'light' : 'dark';
      return newTheme;
    });
  };

  /**
   * Define o tema explicitamente
   */
  const setTheme = (newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme);
    }
  };

  return {
    theme,
    toggleTheme,
    setTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light'
  };
}
