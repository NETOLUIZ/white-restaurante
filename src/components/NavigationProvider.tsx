/**
 * @file src/components/NavigationProvider.tsx
 * @description Provider React global para inicialização do NavigationManager e renderização
 * do Modal de Confirmação de Saída ("Deseja realmente sair?") acessível para PWA / Android.
 */

import React, { useEffect, useState } from 'react';
import { NavigationManager } from '../services/NavigationManager';

interface NavigationProviderProps {
  children: React.ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    NavigationManager.init();
    NavigationManager.setExitModalCallback((show) => {
      setShowExitModal(show);
    });
  }, []);

  const handleConfirmExit = () => {
    setShowExitModal(false);
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  const handleCancelExit = () => {
    setShowExitModal(false);
  };

  return (
    <>
      {children}

      {/* MODAL DE CONFIRMAÇÃO DE SAÍDA DA APLICAÇÃO */}
      {showExitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'atUp 0.2s ease-out',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              textAlign: 'center',
              border: '2px solid #F2E3B0',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚪</div>
            <h2
              id="exit-modal-title"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 800,
                fontSize: '18px',
                color: '#1F2937',
                margin: '0 0 8px 0',
              }}
            >
              Deseja realmente sair?
            </h2>
            <p
              style={{
                fontSize: '13.5px',
                color: '#6B7280',
                margin: '0 0 20px 0',
                lineHeight: 1.4,
              }}
            >
              Você está na página inicial. Se confirmar, você voltará para o navegador ou fechará o aplicativo.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleCancelExit}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1.5px solid #F2E3B0',
                  backgroundColor: '#FFFFFF',
                  color: '#1F2937',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#E53935',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(229,57,53,0.3)',
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
