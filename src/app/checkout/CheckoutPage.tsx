/**
 * @file src/app/checkout/CheckoutPage.tsx
 * @description Página de checkout do pedido.
 */

import React, { useState } from 'react';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { formatarMoeda } from '../../utils/formatters';
import { navigateTo } from '../../router/routes';
import { Comanda } from '../../types';

/**
 * Página de Checkout: resumo e finalização do pedido.
 */
export const CheckoutPage: React.FC = () => {
  const { usuario, logout } = useAuth();
  const [carregando, setCarregando] = useState(false);
  const [etapa, setEtapa] = useState<'resumo' | 'endereco' | 'confirmacao'>('resumo');

  // Simula uma comanda ativa
  const comanda: Comanda = {
    id: '123',
    status: 'aberta',
    itens: [
      {
        produtoId: '1',
        produto: {
          id: '1',
          nome: 'Meia Frango com Batata',
          descricao: 'Delicioso',
          preco: 24.90,
          categoria: 'principais',
          disponivel: true,
          estoque: 50,
        },
        quantidade: 2,
        preco: 49.80,
      },
      {
        produtoId: '3',
        produto: {
          id: '3',
          nome: 'Refrigerante 2L',
          descricao: 'Frio',
          preco: 8.90,
          categoria: 'bebidas',
          disponivel: true,
          estoque: 100,
        },
        quantidade: 1,
        preco: 8.90,
      },
    ],
    subtotal: 58.70,
    taxa_servico: 5.87,
    total: 64.57,
    criada_em: new Date(),
    atualizada_em: new Date(),
  };

  const [endereco, setEndereco] = useState({
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    cep: '',
  });

  const handleEnderecoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEndereco((prev) => ({ ...prev, [name]: value }));
  };

  const handleFinalizarPedido = async () => {
    setCarregando(true);
    // Simula requisição
    setTimeout(() => {
      setCarregando(false);
      setEtapa('confirmacao');
    }, 1500);
  };

  const handleContinuarComprando = () => {
    navigateTo('/cardapio');
  };

  if (etapa === 'confirmacao') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header usuario={usuario} onLogout={logout} />
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-3xl font-bold text-green-600 mb-2">Pedido Confirmado!</h1>
            <p className="text-gray-600 mb-4">Seu pedido foi recebido com sucesso.</p>
            <p className="text-lg font-semibold mb-6">
              Número do Pedido: <span className="text-orange-600">#12345</span>
            </p>
            <p className="text-gray-600 mb-6">
              Prazo de entrega: 30-40 minutos
            </p>

            {/* Botão Chamativo para o Cliente Jogar */}
            <div className="mb-4">
              <a
                href="https://jogo.temnaarea.site/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-jogar-pedido"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '100%',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#ffffff',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  fontSize: '16px',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
                }}
              >
                <span>🎮</span> Jogar e Ganhar Descontos enquanto aguarda seu pedido
              </a>
            </div>

            <Button
              variant="primary"
              tamanho="grande"
              onClick={handleContinuarComprando}
              className="w-full"
            >
              Continuar Comprando
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header usuario={usuario} onLogout={logout} />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8 text-gray-800">Checkout</h2>

        {/* Etapas */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setEtapa('resumo')}
            className={`px-4 py-2 rounded font-semibold text-sm ${
              etapa === 'resumo'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            1. Resumo
          </button>
          <button
            onClick={() => setEtapa('endereco')}
            className={`px-4 py-2 rounded font-semibold text-sm ${
              etapa === 'endereco'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            2. Endereço
          </button>
          <button
            className={`px-4 py-2 rounded font-semibold text-sm bg-gray-100 text-gray-400 cursor-not-allowed`}
          >
            3. Confirmação
          </button>
        </div>

        {/* Resumo do Pedido */}
        {etapa === 'resumo' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">Resumo do Pedido</h3>

            <div className="space-y-3 mb-6">
              {comanda.itens.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center border-b pb-3">
                  <div>
                    <p className="font-semibold">{item.produto.nome}</p>
                    <p className="text-sm text-gray-600">Qtd: {item.quantidade}</p>
                  </div>
                  <span className="font-bold">{formatarMoeda(item.preco)}</span>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 p-4 rounded mb-6 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatarMoeda(comanda.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxa de Serviço:</span>
                <span>{formatarMoeda(comanda.taxa_servico)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span className="text-orange-600">{formatarMoeda(comanda.total)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                tamanho="medio"
                onClick={() => navigateTo('/cardapio')}
                className="flex-1"
              >
                ← Voltar ao Cardápio
              </Button>
              <Button
                variant="primary"
                tamanho="medio"
                onClick={() => setEtapa('endereco')}
                className="flex-1"
              >
                Continuar →
              </Button>
            </div>
          </div>
        )}

        {/* Formulário de Endereço */}
        {etapa === 'endereco' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-4">Endereço de Entrega</h3>

            <div className="space-y-4">
              <Input
                label="Rua"
                name="rua"
                placeholder="Rua..."
                value={endereco.rua}
                onChange={handleEnderecoChange}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Número"
                  name="numero"
                  placeholder="123"
                  value={endereco.numero}
                  onChange={handleEnderecoChange}
                />
                <Input
                  label="CEP"
                  name="cep"
                  placeholder="01310-100"
                  value={endereco.cep}
                  onChange={handleEnderecoChange}
                />
              </div>

              <Input
                label="Complemento"
                name="complemento"
                placeholder="Apt 101 (opcional)"
                value={endereco.complemento}
                onChange={handleEnderecoChange}
              />

              <Input
                label="Bairro"
                name="bairro"
                placeholder="Centro"
                value={endereco.bairro}
                onChange={handleEnderecoChange}
              />

              <Input
                label="Cidade"
                name="cidade"
                placeholder="São Paulo"
                value={endereco.cidade}
                onChange={handleEnderecoChange}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                tamanho="medio"
                onClick={() => setEtapa('resumo')}
                className="flex-1"
              >
                ← Voltar
              </Button>
              <Button
                variant="primary"
                tamanho="medio"
                onClick={handleFinalizarPedido}
                carregando={carregando}
                className="flex-1"
              >
                Finalizar Pedido
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
