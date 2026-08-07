/**
 * @file src/services/NavigationManager.ts
 * @description Gerenciador Global de Navegação, Histórico Interno, Atalhos de Teclado,
 * Foco Acessível e Interceptação do Botão Voltar (Android / Navegador / PWA).
 */

export type NavigationAction = 'PUSH' | 'REPLACE' | 'BACK' | 'FORWARD' | 'CLEAR';

export interface OverlayInfo {
  id: string;
  closeFn: () => void;
  containerRef?: HTMLElement | null;
  elementToRestoreFocus?: HTMLElement | null;
}

export type NavigationListener = (route: string, action: NavigationAction) => void;

export interface ShortcutCallbacks {
  onSave?: () => void;
  onSearch?: () => void;
  onNew?: () => void;
  onPrint?: () => void;
  onConfirm?: () => void;
}

class NavigationManagerClass {
  private historyStack: string[] = [];
  private forwardStack: string[] = [];
  private overlays: OverlayInfo[] = [];
  private listeners: Set<NavigationListener> = new Set();
  private shortcutCallbacks: ShortcutCallbacks = {};
  private initialized = false;
  private isSubmitting = false;
  private submitDebounceTimer: number | null = null;
  private showExitModalCallback: ((show: boolean) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname || '/';
      this.historyStack = [currentPath];
    }
  }

  /**
   * Inicializa os listeners globais de teclado, navegação e PWA.
   * Garante a inclusão de APENAS UM listener global de alta performance.
   */
  public init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // Injeta CSS global de Foco Visível para Acessibilidade
    this.injectFocusStyles();

    // Registra o estado dummy para capturar o botão voltar do Android / Browser
    this.pushDummyHistoryState();

    // Event Listener Global Único para Teclado
    window.addEventListener('keydown', this.handleKeyDown, true);

    // Event Listener Global Único para Popstate (Android Back Button / Browser Back)
    window.addEventListener('popstate', this.handlePopState);

    // Event Listener para capturar o envio da aplicação PWA/Standalone
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  /**
   * Destrói os listeners globais (limpeza em unmount se necessário).
   */
  public destroy(): void {
    if (!this.initialized || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.handleKeyDown, true);
    window.removeEventListener('popstate', this.handlePopState);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.initialized = false;
  }

  /**
   * Define o callback do modal de confirmação de saída.
   */
  public setExitModalCallback(cb: (show: boolean) => void): void {
    this.showExitModalCallback = cb;
  }

  /**
   * Registra rotinas customizadas de atalhos globais (Ctrl+S, Ctrl+F, Ctrl+N, etc.)
   */
  public registerShortcuts(callbacks: ShortcutCallbacks): () => void {
    this.shortcutCallbacks = { ...this.shortcutCallbacks, ...callbacks };
    return () => {
      this.shortcutCallbacks = {};
    };
  }

  /**
   * Registra um modal, drawer, sidebar, dialog ou popover aberto.
   * Suporta Focus Trap e devolução automática de foco ao fechar.
   */
  public registerOverlay(id: string, closeFn: () => void, containerRef?: HTMLElement | null): void {
    const activeEl = document.activeElement as HTMLElement | null;
    this.overlays.push({
      id,
      closeFn,
      containerRef,
      elementToRestoreFocus: activeEl,
    });

    // Foca o primeiro elemento focado dentro do overlay
    if (containerRef) {
      setTimeout(() => {
        const focusable = this.getFocusableElements(containerRef);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          containerRef.focus();
        }
      }, 50);
    }
  }

  /**
   * Remove o registro de um overlay fechado e restaura o foco anterior.
   */
  public unregisterOverlay(id: string): void {
    const index = this.overlays.findIndex((o) => o.id === id);
    if (index !== -1) {
      const [removed] = this.overlays.splice(index, 1);
      if (removed && removed.elementToRestoreFocus && typeof removed.elementToRestoreFocus.focus === 'function') {
        setTimeout(() => removed.elementToRestoreFocus?.focus(), 50);
      }
    }
  }

  /**
   * Fecha o overlay mais recente no topo da pilha.
   * Retorna true se fechou algo, false caso nenhum estivesse aberto.
   */
  public closeTopmostOverlay(): boolean {
    if (this.overlays.length > 0) {
      const top = this.overlays.pop();
      if (top) {
        top.closeFn();
        if (top.elementToRestoreFocus && typeof top.elementToRestoreFocus.focus === 'function') {
          setTimeout(() => top.elementToRestoreFocus?.focus(), 50);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Retorna se há algum modal/overlay aberto no momento.
   */
  public hasOpenOverlay(): boolean {
    return this.overlays.length > 0;
  }

  // ==========================================
  // NAVEGAÇÃO & HISTÓRICO INTERNO
  // ==========================================

  public push(route: string, state?: any): void {
    if (typeof window === 'undefined') return;
    const current = this.getCurrentRoute();
    if (current !== route) {
      this.historyStack.push(route);
      this.forwardStack = [];
      window.history.pushState(state || {}, '', route);
      this.notifyListeners(route, 'PUSH');
    }
  }

  public replace(route: string, state?: any): void {
    if (typeof window === 'undefined') return;
    if (this.historyStack.length > 0) {
      this.historyStack[this.historyStack.length - 1] = route;
    } else {
      this.historyStack.push(route);
    }
    window.history.replaceState(state || {}, '', route);
    this.notifyListeners(route, 'REPLACE');
  }

  public goBack(): void {
    if (typeof window === 'undefined') return;

    // Prioridade 1: fechar modal/overlay se aberto
    if (this.closeTopmostOverlay()) {
      this.pushDummyHistoryState();
      return;
    }

    // Prioridade 2: voltar no histórico interno se existir página anterior
    if (this.historyStack.length > 1) {
      const current = this.historyStack.pop();
      if (current) this.forwardStack.push(current);
      const previousRoute = this.historyStack[this.historyStack.length - 1] || '/';
      window.history.pushState({}, '', previousRoute);
      this.notifyListeners(previousRoute, 'BACK');
      return;
    }

    // Prioridade 3: se estiver na home/inicial e não tiver histórico -> solicitar confirmação de saída
    this.triggerExitConfirmation();
  }

  public goForward(): void {
    if (typeof window === 'undefined') return;
    if (this.forwardStack.length > 0) {
      const nextRoute = this.forwardStack.pop();
      if (nextRoute) {
        this.historyStack.push(nextRoute);
        window.history.pushState({}, '', nextRoute);
        this.notifyListeners(nextRoute, 'FORWARD');
      }
    }
  }

  public clearHistory(): void {
    const current = this.getCurrentRoute();
    this.historyStack = [current];
    this.forwardStack = [];
    this.notifyListeners(current, 'CLEAR');
  }

  public getHistory(): string[] {
    return [...this.historyStack];
  }

  public getCurrentRoute(): string {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname || '/';
  }

  public subscribe(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(route: string, action: NavigationAction): void {
    this.listeners.forEach((fn) => fn(route, action));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('routechange', { detail: { route, action } }));
      window.dispatchEvent(new CustomEvent('navigationchange', { detail: { route, action } }));
    }
  }

  // ==========================================
  // TRAP DE TECLAS E MANIPULAÇÃO GLOBAL
  // ==========================================

  private handleKeyDown = (e: KeyboardEvent): void => {
    const isInput = this.isEditableElement(e.target as HTMLElement);

    // --- ESC: Fechar Modal/Overlay > Limpar Input > Voltar ---
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.hasOpenOverlay()) {
        this.closeTopmostOverlay();
        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        const input = activeEl as HTMLInputElement;
        if (input.value && input.value.trim() !== '') {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
        activeEl.blur();
        return;
      }

      this.goBack();
      return;
    }

    // --- SHORTCUTS GLOBAIS COM CTRL / CMD ---
    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl) {
      const key = e.key.toLowerCase();

      // Ctrl + S (Salvar)
      if (key === 's') {
        e.preventDefault();
        if (this.shortcutCallbacks.onSave) {
          this.shortcutCallbacks.onSave();
        } else {
          this.triggerActiveFormSubmit();
        }
        return;
      }

      // Ctrl + F (Pesquisar)
      if (key === 'f') {
        e.preventDefault();
        if (this.shortcutCallbacks.onSearch) {
          this.shortcutCallbacks.onSearch();
        } else {
          this.focusSearchInput();
        }
        return;
      }

      // Ctrl + N (Novo)
      if (key === 'n') {
        e.preventDefault();
        if (this.shortcutCallbacks.onNew) {
          this.shortcutCallbacks.onNew();
        }
        return;
      }

      // Ctrl + P (Imprimir)
      if (key === 'p') {
        e.preventDefault();
        if (this.shortcutCallbacks.onPrint) {
          this.shortcutCallbacks.onPrint();
        } else {
          window.print();
        }
        return;
      }

      // Ctrl + Enter (Confirmar ação principal)
      if (key === 'enter') {
        e.preventDefault();
        if (this.shortcutCallbacks.onConfirm) {
          this.shortcutCallbacks.onConfirm();
        } else {
          this.triggerActiveFormSubmit();
        }
        return;
      }
    }

    // --- ENTER: Navegação entre campos de Formulário e Clique Anti-Duplo ---
    if (e.key === 'Enter' && !isCtrl) {
      if (this.isSubmitting) {
        e.preventDefault();
        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && activeEl.tagName === 'INPUT') {
        const form = activeEl.closest('form');
        if (form) {
          const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])')) as HTMLElement[];
          const currentIndex = inputs.indexOf(activeEl);
          if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
            e.preventDefault();
            inputs[currentIndex + 1].focus();
            return;
          }
        }
      }

      // Evita duplo envio acidental
      this.preventDoubleSubmit();
    }

    // --- TAB / SHIFT+TAB: Focus Trap em Modais Abertos ---
    if (e.key === 'Tab') {
      if (this.hasOpenOverlay()) {
        const topmost = this.overlays[this.overlays.length - 1];
        if (topmost && topmost.containerRef) {
          this.trapFocus(e, topmost.containerRef);
        }
      }
    }

    // --- NAV COM ARROW KEYS EM LISTAS E GRIDS ---
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isInput) {
      this.handleArrowNavigation(e);
    }

    // --- ESPAÇO: Selecionar Card / Checkbox / Elemento com Foco ---
    if (e.key === ' ' && !isInput) {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.classList.contains('pos-prod-card') || activeEl.classList.contains('pos-nav-item') || activeEl.getAttribute('role') === 'checkbox')) {
        e.preventDefault();
        activeEl.click();
      }
    }
  };

  /**
   * Previne duplo clique / envio duplicado de ações principais.
   */
  private preventDoubleSubmit(): void {
    this.isSubmitting = true;
    if (this.submitDebounceTimer) window.clearTimeout(this.submitDebounceTimer);
    this.submitDebounceTimer = window.setTimeout(() => {
      this.isSubmitting = false;
    }, 500);
  }

  /**
   * Gerencia a navegação com setas em Grids e Listas acessíveis.
   */
  private handleArrowNavigation(e: KeyboardEvent): void {
    const activeEl = document.activeElement as HTMLElement | null;
    if (!activeEl) return;

    const parentGrid = activeEl.closest('.pos-cards-grid-2col, .pos-cards-grid-auto, [role="grid"], .pos-nav-list') as HTMLElement | null;
    if (!parentGrid) return;

    const items = Array.from(parentGrid.querySelectorAll('.pos-prod-card, .pos-nav-item, [role="gridcell"], [role="option"], button')) as HTMLElement[];
    const currentIndex = items.indexOf(activeEl);
    if (currentIndex === -1) return;

    e.preventDefault();

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      const next = items[(currentIndex + 1) % items.length];
      if (next) next.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      const prev = items[(currentIndex - 1 + items.length) % items.length];
      if (prev) prev.focus();
    }
  }

  /**
   * Foco Trap isolado dentro de contêineres de Modais/Drawers.
   */
  private trapFocus(e: KeyboardEvent, container: HTMLElement): void {
    const focusables = this.getFocusableElements(container);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /**
   * Retorna os elementos focáveis contidos dentro de um contêiner.
   */
  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }

  /**
   * Verifica se o elemento focado é de edição de texto.
   */
  private isEditableElement(el: HTMLElement | null): boolean {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  /**
   * Tenta submeter o formulário ativo ou disparar o botão primário.
   */
  private triggerActiveFormSubmit(): void {
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl) {
      const form = activeEl.closest('form');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement | null;
        if (submitBtn) {
          submitBtn.click();
          return;
        }
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        return;
      }
    }
    const primaryBtn = document.querySelector('.pos-btn-checkout, button[type="submit"], .btn-primary') as HTMLElement | null;
    if (primaryBtn && !primaryBtn.hasAttribute('disabled')) {
      primaryBtn.click();
    }
  }

  /**
   * Foca automaticamente no campo de busca presente na página.
   */
  private focusSearchInput(): void {
    const searchInput = document.querySelector('input[type="search"], input[name="search"], input[placeholder*="buscar" i], input[placeholder*="pesquisar" i]') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  // ==========================================
  // BOTÃO VOLTAR ANDROID / NAV E POPSTATE
  // ==========================================

  private handlePopState = (e: PopStateEvent): void => {
    // Se havia algum overlay aberto, fecha e previne a saída
    if (this.closeTopmostOverlay()) {
      this.pushDummyHistoryState();
      return;
    }

    // Se temos mais de um item no histórico interno, volta no aplicativo
    if (this.historyStack.length > 1) {
      const current = this.historyStack.pop();
      if (current) this.forwardStack.push(current);
      const prev = this.historyStack[this.historyStack.length - 1] || '/';
      this.notifyListeners(prev, 'BACK');
      this.pushDummyHistoryState();
      return;
    }

    // Se estamos no início e o usuário clicou no voltar físico -> Mostra modal de confirmação de saída
    this.triggerExitConfirmation();
  };

  private triggerExitConfirmation(): void {
    this.pushDummyHistoryState();
    if (this.showExitModalCallback) {
      this.showExitModalCallback(true);
    } else {
      const confirmExit = window.confirm('Deseja realmente sair da aplicação?');
      if (confirmExit) {
        window.history.back();
      }
    }
  }

  private pushDummyHistoryState(): void {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ appHistoryLock: true }, '', window.location.href);
    }
  }

  private handleBeforeUnload = (e: BeforeUnloadEvent): void => {
    // Permite que PWA em modo standalone registre navegação limpa
  };

  /**
   * Injeta o CSS de Foco Visível para acessibilidade absoluta e WCAG compliance.
   */
  private injectFocusStyles(): void {
    if (typeof document === 'undefined' || document.getElementById('nav-focus-styles')) return;
    const style = document.createElement('style');
    style.id = 'nav-focus-styles';
    style.innerHTML = `
      *:focus-visible {
        outline: 3px solid #E53935 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(229, 57, 53, 0.25) !important;
      }
      .pos-prod-card:focus-visible, .pos-nav-item:focus-visible {
        border-color: #E53935 !important;
        transform: translateY(-2px);
      }
    `;
    document.head.appendChild(style);
  }
}

export const NavigationManager = new NavigationManagerClass();

if (typeof window !== 'undefined') {
  (window as any).NavigationManager = NavigationManager;
  NavigationManager.init();
}
