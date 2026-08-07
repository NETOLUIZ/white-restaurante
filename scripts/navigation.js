/**
 * @file scripts/navigation.js
 * @description Runtime Global de Navegação e Atalhos por Teclado para páginas HTML/DC
 * (Atendente, Garçom, Entregador, Empresa, Admin, Cliente).
 */

(function () {
  'use strict';

  if (window.NavigationManager) return;

  var historyStack = [window.location.pathname || '/'];
  var forwardStack = [];
  var overlays = [];
  var isSubmitting = false;
  var submitDebounceTimer = null;
  var showExitModalCallback = null;

  function injectFocusStyles() {
    if (document.getElementById('nav-focus-styles-global')) return;
    var style = document.createElement('style');
    style.id = 'nav-focus-styles-global';
    style.innerHTML =
      '*:focus-visible {' +
      '  outline: 3px solid #E53935 !important;' +
      '  outline-offset: 2px !important;' +
      '  box-shadow: 0 0 0 4px rgba(229, 57, 53, 0.25) !important;' +
      '}' +
      '.pos-prod-card:focus-visible, .pos-nav-item:focus-visible {' +
      '  border-color: #E53935 !important;' +
      '  transform: translateY(-2px);' +
      '}';
    document.head.appendChild(style);
  }

  function pushDummyHistoryState() {
    if (window.history && window.history.pushState) {
      window.history.pushState({ appHistoryLock: true }, '', window.location.href);
    }
  }

  function getFocusableElements(container) {
    var selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(container.querySelectorAll(selector));
  }

  function isEditableElement(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function closeTopmostOverlay() {
    if (overlays.length > 0) {
      var top = overlays.pop();
      if (top && typeof top.closeFn === 'function') {
        top.closeFn();
        if (top.elementToRestoreFocus && typeof top.elementToRestoreFocus.focus === 'function') {
          setTimeout(function () { top.elementToRestoreFocus.focus(); }, 50);
        }
        return true;
      }
    }
    return false;
  }

  function goBack() {
    if (closeTopmostOverlay()) {
      pushDummyHistoryState();
      return;
    }

    if (historyStack.length > 1) {
      var current = historyStack.pop();
      if (current) forwardStack.push(current);
      var prev = historyStack[historyStack.length - 1] || '/';
      window.history.pushState({}, '', prev);
      window.dispatchEvent(new CustomEvent('routechange', { detail: { route: prev, action: 'BACK' } }));
      return;
    }

    triggerExitConfirmation();
  }

  function triggerExitConfirmation() {
    pushDummyHistoryState();
    if (typeof showExitModalCallback === 'function') {
      showExitModalCallback(true);
    } else {
      var confirmExit = window.confirm('Deseja realmente sair da aplicação?');
      if (confirmExit) {
        window.history.back();
      }
    }
  }

  function handleKeyDown(e) {
    var isInput = isEditableElement(e.target);

    // ESC
    if (e.key === 'Escape') {
      e.preventDefault();
      if (overlays.length > 0) {
        closeTopmostOverlay();
        return;
      }
      var activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        if (activeEl.value && activeEl.value.trim() !== '') {
          activeEl.value = '';
          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
        activeEl.blur();
        return;
      }
      goBack();
      return;
    }

    // CTRL / CMD SHORTCUTS
    var isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl) {
      var key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        triggerFormSubmit();
        return;
      }
      if (key === 'f') {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (key === 'p') {
        e.preventDefault();
        window.print();
        return;
      }
      if (key === 'enter') {
        e.preventDefault();
        triggerFormSubmit();
        return;
      }
    }

    // ENTER
    if (e.key === 'Enter' && !isCtrl) {
      if (isSubmitting) {
        e.preventDefault();
        return;
      }
      var el = document.activeElement;
      if (el && el.tagName === 'INPUT') {
        var form = el.closest('form');
        if (form) {
          var inputs = Array.prototype.slice.call(form.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'));
          var idx = inputs.indexOf(el);
          if (idx !== -1 && idx < inputs.length - 1) {
            e.preventDefault();
            inputs[idx + 1].focus();
            return;
          }
        }
      }
      isSubmitting = true;
      if (submitDebounceTimer) clearTimeout(submitDebounceTimer);
      submitDebounceTimer = setTimeout(function () { isSubmitting = false; }, 500);
    }

    // ARROWS NAV
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) !== -1 && !isInput) {
      var active = document.activeElement;
      if (active) {
        var parentGrid = active.closest('.pos-cards-grid-2col, .pos-cards-grid-auto, [role="grid"], .pos-nav-list');
        if (parentGrid) {
          var items = Array.prototype.slice.call(parentGrid.querySelectorAll('.pos-prod-card, .pos-nav-item, [role="gridcell"], [role="option"], button'));
          var curIdx = items.indexOf(active);
          if (curIdx !== -1) {
            e.preventDefault();
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
              items[(curIdx + 1) % items.length].focus();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
              items[(curIdx - 1 + items.length) % items.length].focus();
            }
          }
        }
      }
    }

    // SPACE
    if (e.key === ' ' && !isInput) {
      var act = document.activeElement;
      if (act && (act.classList.contains('pos-prod-card') || act.classList.contains('pos-nav-item') || act.getAttribute('role') === 'checkbox')) {
        e.preventDefault();
        act.click();
      }
    }
  }

  function triggerFormSubmit() {
    var activeEl = document.activeElement;
    if (activeEl) {
      var form = activeEl.closest('form');
      if (form) {
        var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) { submitBtn.click(); return; }
      }
    }
    var primaryBtn = document.querySelector('.pos-btn-checkout, button[type="submit"], .btn-primary');
    if (primaryBtn && !primaryBtn.hasAttribute('disabled')) {
      primaryBtn.click();
    }
  }

  function focusSearch() {
    var searchInput = document.querySelector('input[type="search"], input[name="search"], input[placeholder*="buscar" i], input[placeholder*="pesquisar" i]');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  function handlePopState() {
    if (closeTopmostOverlay()) {
      pushDummyHistoryState();
      return;
    }
    if (historyStack.length > 1) {
      var current = historyStack.pop();
      if (current) forwardStack.push(current);
      var prev = historyStack[historyStack.length - 1] || '/';
      window.dispatchEvent(new CustomEvent('routechange', { detail: { route: prev, action: 'BACK' } }));
      pushDummyHistoryState();
      return;
    }
    triggerExitConfirmation();
  }

  // Objeto Global NavigationManager
  window.NavigationManager = {
    init: function () {
      injectFocusStyles();
      pushDummyHistoryState();
      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('popstate', handlePopState);
    },
    push: function (route) {
      historyStack.push(route);
      forwardStack = [];
      window.history.pushState({}, '', route);
      window.dispatchEvent(new CustomEvent('routechange', { detail: { route: route, action: 'PUSH' } }));
    },
    replace: function (route) {
      if (historyStack.length > 0) historyStack[historyStack.length - 1] = route;
      else historyStack.push(route);
      window.history.replaceState({}, '', route);
      window.dispatchEvent(new CustomEvent('routechange', { detail: { route: route, action: 'REPLACE' } }));
    },
    goBack: goBack,
    registerOverlay: function (id, closeFn, containerRef) {
      overlays.push({ id: id, closeFn: closeFn, containerRef: containerRef, elementToRestoreFocus: document.activeElement });
    },
    unregisterOverlay: function (id) {
      var idx = overlays.findIndex(function (o) { return o.id === id; });
      if (idx !== -1) overlays.splice(idx, 1);
    },
    setExitModalCallback: function (cb) {
      showExitModalCallback = cb;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.NavigationManager.init(); });
  } else {
    window.NavigationManager.init();
  }
})();
