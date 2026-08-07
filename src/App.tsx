/**
 * @file src/App.tsx
 * @description Componente raiz que gerencia rotas e fluxo da aplicação.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { getCurrentRoute, navigateTo, RouteType } from './router/routes';
import { NavigationProvider } from './components/NavigationProvider';

// Páginas
import { LoginPage } from './app/login/LoginPage';
import { ClientePage } from './app/cliente/ClientePage';
import { CardapioPage } from './app/cardapio/CardapioPage';
import { CheckoutPage } from './app/checkout/CheckoutPage';
import { MesasPage } from './app/mesas/MesasPage';
import { AdminPage } from './app/admin/AdminPage';

/**
 * Componente App: raiz da aplicação com roteamento e NavigationProvider global.
 */
export const App: React.FC = () => {
  const { autenticado, usuario } = useAuth();
  const [rota, setRota] = useState<RouteType>(getCurrentRoute());

  // Listener para mudanças de rota
  useEffect(() => {
    const handleRouteChange = () => {
      setRota(getCurrentRoute());
    };

    window.addEventListener('routechange', handleRouteChange);
    return () => window.removeEventListener('routechange', handleRouteChange);
  }, []);

  // Se a rota é /admin ou /login e não está autenticado, redireciona para /
  useEffect(() => {
    if ((rota === '/admin' || rota === '/login') && !autenticado && rota !== '/') {
      navigateTo('/');
    }
  }, [autenticado, rota]);

  /**
   * Renderiza o componente correto baseado na rota.
   */
  const renderarPagina = () => {
    switch (rota) {
      case '/':
        return <ClientePage />;

      case '/cardapio':
        return <CardapioPage />;

      case '/checkout':
        return <CheckoutPage />;

      case '/login':
        return autenticado ? <AdminPage /> : <LoginPage />;

      case '/admin':
        return autenticado ? <AdminPage /> : <LoginPage />;

      case '/mesas':
        return <MesasPage />;

      default:
        return <ClientePage />;
    }
  };

  return (
    <NavigationProvider>
      <div id="app-root">{renderarPagina()}</div>
    </NavigationProvider>
  );
};

