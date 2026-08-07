/**
 * @file src/hooks/useNavigation.ts
 * @description Hook React reutilizável para integração simples com o NavigationManager.
 */

import { useState, useEffect, useCallback } from 'react';
import { NavigationManager, NavigationAction, ShortcutCallbacks } from '../services/NavigationManager';

export function useNavigation() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => NavigationManager.getCurrentRoute());
  const [history, setHistory] = useState<string[]>(() => NavigationManager.getHistory());

  useEffect(() => {
    // Inicializa o NavigationManager se ainda não tiver sido inicializado
    NavigationManager.init();

    // Inscreve-se para escutar mudanças de rota
    const unsubscribe = NavigationManager.subscribe((route: string) => {
      setCurrentRoute(route);
      setHistory(NavigationManager.getHistory());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const push = useCallback((path: string, state?: any) => {
    NavigationManager.push(path, state);
  }, []);

  const replace = useCallback((path: string, state?: any) => {
    NavigationManager.replace(path, state);
  }, []);

  const goBack = useCallback(() => {
    NavigationManager.goBack();
  }, []);

  const goForward = useCallback(() => {
    NavigationManager.goForward();
  }, []);

  const registerOverlay = useCallback((id: string, closeFn: () => void, containerRef?: HTMLElement | null) => {
    NavigationManager.registerOverlay(id, closeFn, containerRef);
    return () => NavigationManager.unregisterOverlay(id);
  }, []);

  const registerShortcuts = useCallback((callbacks: ShortcutCallbacks) => {
    return NavigationManager.registerShortcuts(callbacks);
  }, []);

  return {
    currentRoute,
    history,
    push,
    replace,
    goBack,
    goForward,
    registerOverlay,
    registerShortcuts,
    hasOpenOverlay: NavigationManager.hasOpenOverlay(),
  };
}
