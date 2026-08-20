/**
 * @file app/admin/AdminPage.tsx
 * @description Página do painel de administração com gerenciamento de pedidos e opção de re-impressão de recibos.
 */

import React, { useState, useEffect } from 'react';
import { Pedido } from '../../types';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';
import { formatarMoeda, formatarDataHora } from '../../utils/formatters';

export const AdminPage: React.FC = () => {
  const { usuario, logout } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [busca, setBusca] = useState<string>('');
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);

  // Carrega pedidos iniciais (simulados/API)
  useEffect(() => {
    setTimeout(() => {
      setPedidos([
        {
          id: '#BF101',
          clienteId: 'cli1',
          status: 'preparando',
          itens: [
            {
              produtoId: 'p1',
              produto: { id: 'p1', nome: 'Frango Assado Inteiro', descricao: 'Com batatas coradas', preco: 49.9, categoria: 'Frangos', disponivel: true, estoque: 20 },
              quantidade: 1,
              observacoes: 'Bem assado, por favor',
              preco: 49.9,
            },
            {
              produtoId: 'p2',
              produto: { id: 'p2', nome: 'Guaraná 2L', descricao: 'Refrigerante', preco: 12.0, categoria: 'Bebidas', disponivel: true, estoque: 50 },
              quantidade: 1,
              preco: 12.0,
            },
          ],
          endereco: {
            rua: 'Rua das Flores',
            numero: '123',
            complemento: 'Apto 4B',
            bairro: 'Centro',
            cidade: 'São Paulo',
            cep: '01310-100',
          },
          subtotal: 61.9,
          taxa_entrega: 6.0,
          total: 67.9,
          observacoes: 'Entregar na portaria',
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
        {
          id: '#BF102',
          clienteId: 'cli2',
          status: 'saiu_entrega',
          itens: [
            {
              produtoId: 'p3',
              produto: { id: 'p3', nome: 'Meio Frango com Farofa', descricao: 'Acompanha farofa da casa', preco: 29.9, categoria: 'Frangos', disponivel: true, estoque: 15 },
              quantidade: 2,
              preco: 59.8,
            },
          ],
          endereco: {
            rua: 'Av. Paulista',
            numero: '900',
            bairro: 'Bela Vista',
            cidade: 'São Paulo',
            cep: '01310-200',
          },
          subtotal: 59.8,
          taxa_entrega: 7.5,
          total: 67.3,
          criado_em: new Date(Date.now() - 25 * 60 * 1000),
          atualizado_em: new Date(Date.now() - 10 * 60 * 1000),
        },
        {
          id: '#BF103',
          clienteId: 'cli3',
          status: 'entregue',
          itens: [
            {
              produtoId: 'p1',
              produto: { id: 'p1', nome: 'Frango Assado Inteiro', descricao: 'Com batatas coradas', preco: 49.9, categoria: 'Frangos', disponivel: true, estoque: 20 },
              quantidade: 1,
              preco: 49.9,
            },
          ],
          endereco: {
            rua: 'Rua Augusta',
            numero: '450',
            bairro: 'Consolação',
            cidade: 'São Paulo',
            cep: '01305-000',
          },
          subtotal: 49.9,
          taxa_entrega: 5.0,
          total: 54.9,
          criado_em: new Date(Date.now() - 120 * 60 * 1000),
          atualizado_em: new Date(Date.now() - 60 * 60 * 1000),
        },
      ]);
      setCarregando(false);
    }, 500);
  }, []);

  /**
   * Função para imprimir ou re-imprimir o recibo do pedido em impressora térmica (58mm/80mm e Mobile/RawBT)
   */
  const reImprimirRecibo = (pedido: Pedido) => {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '') ||
      (window.innerWidth <= 768 && 'ontouchstart' in window);

    const agora = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itensHtml = (pedido.itens || [])
      .map(
        (item) => `
        <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
          <span>${item.quantidade}x ${item.produto?.nome || 'Item'}</span>
          <span>${formatarMoeda(item.preco || (item.produto?.preco || 0) * item.quantidade)}</span>
        </div>
        ${item.observacoes ? `<div style="padding-left:10px; font-size:11px; color:#555;">obs: ${item.observacoes}</div>` : ''}
      `
      )
      .join('');

    const endereco = pedido.endereco
      ? `${pedido.endereco.rua}, ${pedido.endereco.numero}${pedido.endereco.complemento ? ' - ' + pedido.endereco.complemento : ''} - ${pedido.endereco.bairro}`
      : 'Retirada no balcão';

    const textoPuro = [
      'BEL DO FRANGO',
      `PEDIDO ${pedido.id}`,
      '================================',
      `Endereço: ${endereco}`,
      '================================',
      ...(pedido.itens || []).map((it) => `${it.quantidade}x ${it.produto?.nome || 'Item'}`),
      '================================',
      `Subtotal: ${formatarMoeda(pedido.subtotal)}`,
      pedido.taxa_entrega ? `Taxa Entrega: ${formatarMoeda(pedido.taxa_entrega)}` : '',
      `TOTAL: ${formatarMoeda(pedido.total)}`,
      '================================',
      '*** REIMPRESSÃO ***',
      agora,
      '\n\n\n',
    ]
      .filter(Boolean)
      .join('\n');

    const textoFormatado = String(textoPuro || '').replace(/\r?\n/g, '\r\n') + '\r\n\r\n\r\n\r\n';
    const b64 = typeof window !== 'undefined' ? btoa(unescape(encodeURIComponent(textoFormatado))) : '';

    if (isMobile) {
      if (b64) {
        try {
          window.location.href = 'rawbt:data:text/plain;charset=utf-8;base64,' + b64;
          return;
        } catch (e) {}
      }

      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Recibo Pedido ${pedido.id}</title>
            <style>
              @page { size: 58mm auto; margin: 0; }
              body {
                width: 48mm;
                margin: 0 auto;
                padding: 4mm 2mm;
                font-family: 'Courier New', Courier, monospace;
                font-size: 12px;
                line-height: 1.4;
                color: #000;
              }
              .c { text-align: center; }
              .r { text-align: right; }
              .b { font-weight: bold; }
              .tit { font-size: 15px; font-weight: bold; margin-bottom: 4px; }
              .sep { border-bottom: 1px dashed #000; margin: 6px 0; }
              .destaque { font-size: 11px; text-align: center; margin-top: 8px; font-weight: bold; }
              .btn-print { display: block; width: 100%; margin: 15px 0; padding: 14px; background: #2D9E60; color: #fff; font-size: 16px; font-weight: bold; border: none; border-radius: 10px; cursor: pointer; }
              .btn-rawbt { display: block; width: 100%; margin: 8px 0; padding: 12px; background: #0284C7; color: #fff; font-size: 14px; font-weight: bold; border: none; border-radius: 10px; text-decoration: none; text-align: center; }
              @media print { .no-print { display: none !important; } }
            </style>
          </head>
          <body>
            <div class="no-print">
              <button class="btn-print" onclick="window.print()">🖨️ IMPRIMIR RECIBO</button>
              <a class="btn-rawbt" href="rawbt:data:text/plain;charset=utf-8;base64,${b64}">📱 Imprimir via RawBT (Bluetooth)</a>
              <hr style="margin:12px 0; border:none; border-top:1px dashed #ccc;"/>
            </div>
            <div class="c tit">BEL DO FRANGO</div>
            <div class="c b">PEDIDO ${pedido.id}</div>
            <div class="sep"></div>
            <div><span class="b">Endereço:</span> ${endereco}</div>
            <div class="sep"></div>
            ${itensHtml}
            <div class="sep"></div>
            <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span> <span>${formatarMoeda(pedido.subtotal)}</span></div>
            ${pedido.taxa_entrega ? `<div style="display:flex; justify-content:space-between;"><span>Taxa Entrega:</span> <span>${formatarMoeda(pedido.taxa_entrega)}</span></div>` : ''}
            <div style="display:flex; justify-content:space-between;" class="b"><span>TOTAL:</span> <span>${formatarMoeda(pedido.total)}</span></div>
            <div class="sep"></div>
            <div class="destaque">*** REIMPRESSÃO ***</div>
            <div class="c" style="font-size:10px; margin-top:4px;">${agora}</div>
            <script>
              setTimeout(function(){ try { window.focus(); window.print(); } catch(e){} }, 350);
            </script>
          </body>
          </html>
        `);
        win.document.close();
        return;
      }
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 58mm auto; margin: 0; }
          body {
            width: 48mm;
            margin: 0 auto;
            padding: 4mm 1mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
          }
          .c { text-align: center; }
          .r { text-align: right; }
          .b { font-weight: bold; }
          .tit { font-size: 15px; font-weight: bold; margin-bottom: 4px; }
          .sep { border-bottom: 1px dashed #000; margin: 6px 0; }
          .destaque { font-size: 11px; text-align: center; margin-top: 8px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="c tit">BEL DO FRANGO</div>
        <div class="c b">PEDIDO ${pedido.id}</div>
        <div class="sep"></div>
        <div><span class="b">Endereço:</span> ${endereco}</div>
        <div class="sep"></div>
        ${itensHtml}
        <div class="sep"></div>
        <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span> <span>${formatarMoeda(pedido.subtotal)}</span></div>
        ${pedido.taxa_entrega ? `<div style="display:flex; justify-content:space-between;"><span>Taxa Entrega:</span> <span>${formatarMoeda(pedido.taxa_entrega)}</span></div>` : ''}
        <div style="display:flex; justify-content:space-between;" class="b"><span>TOTAL:</span> <span>${formatarMoeda(pedido.total)}</span></div>
        <div class="sep"></div>
        <div class="destaque">*** REIMPRESSÃO ***</div>
        <div class="c" style="font-size:10px; margin-top:4px;">${agora}</div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {}
      setTimeout(() => iframe.remove(), 1000);
    }, 250);
  };

  // Filtragem de pedidos por status e busca
  const pedidosFiltrados = pedidos.filter((p) => {
    const atendeStatus = filtroStatus === 'todos' || p.status === filtroStatus;
    const q = busca.trim().toLowerCase();
    const atendeBusca =
      !q ||
      p.id.toLowerCase().includes(q) ||
      p.clienteId.toLowerCase().includes(q) ||
      (p.endereco?.bairro && p.endereco.bairro.toLowerCase().includes(q)) ||
      p.itens.some((it) => it.produto?.nome.toLowerCase().includes(q));
    return atendeStatus && atendeBusca;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'preparando':
        return <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-bold">EM PREPARO</span>;
      case 'saiu_entrega':
        return <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-bold">SAIU P/ ENTREGA</span>;
      case 'entregue':
        return <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold">CONCLUÍDO</span>;
      case 'cancelado':
        return <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-xs font-bold">CANCELADO</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full text-xs font-bold">{status.toUpperCase()}</span>;
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-amber-50">
        <span className="text-xl font-semibold text-amber-900">Carregando painel de pedidos...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50/30 text-gray-900">
      <Header usuario={usuario} onLogout={logout} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-amber-950">Painel de Pedidos</h2>
            <p className="text-sm text-amber-800/80">Gerencie e re-imprima cupons de atendimento em tempo real</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar por ID, bairro ou item..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="px-4 py-2 bg-white border border-amber-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 w-64"
            />
          </div>
        </div>

        {/* Filtros de Status */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'preparando', label: 'Em Preparo' },
            { id: 'saiu_entrega', label: 'Saiu p/ Entrega' },
            { id: 'entregue', label: 'Concluídos' },
            { id: 'cancelado', label: 'Cancelados' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFiltroStatus(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                filtroStatus === tab.id
                  ? 'bg-amber-700 text-white shadow-md'
                  : 'bg-white text-amber-900 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tabela de Pedidos */}
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-amber-100/50 border-b border-amber-100 text-amber-900 text-xs uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Pedido ID</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Itens</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {pedidosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              ) : (
                pedidosFiltrados.map((pedido) => (
                  <tr
                    key={pedido.id}
                    className="hover:bg-amber-50/40 transition-colors cursor-pointer"
                    onClick={() => setPedidoSelecionado(pedido)}
                  >
                    <td className="px-6 py-4 font-mono font-bold text-amber-900">{pedido.id}</td>
                    <td className="px-6 py-4">{getStatusBadge(pedido.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                      {pedido.itens.map((i) => `${i.quantidade}x ${i.produto?.nome || 'Item'}`).join(', ')}
                    </td>
                    <td className="px-6 py-4 font-extrabold text-amber-900">{formatarMoeda(pedido.total)}</td>
                    <td className="px-6 py-4 text-xs text-gray-500">{formatarDataHora(pedido.criado_em)}</td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => reImprimirRecibo(pedido)}
                        className="inline-flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                        title="Reimprimir recibo para cozinha ou entrega"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                          />
                        </svg>
                        Reimprimir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal de Detalhes do Pedido */}
      {pedidoSelecionado && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-amber-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-amber-100 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-black text-amber-950">Detalhes do Pedido</h3>
                <span className="font-mono text-xs font-bold text-amber-700">{pedidoSelecionado.id}</span>
              </div>
              <button
                onClick={() => setPedidoSelecionado(null)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm mb-6">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Status</span>
                {getStatusBadge(pedidoSelecionado.status)}
              </div>

              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Endereço de Entrega</span>
                <p className="text-gray-800">
                  {pedidoSelecionado.endereco.rua}, {pedidoSelecionado.endereco.numero}
                  {pedidoSelecionado.endereco.complemento ? ` (${pedidoSelecionado.endereco.complemento})` : ''} -{' '}
                  {pedidoSelecionado.endereco.bairro}, {pedidoSelecionado.endereco.cidade}
                </p>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Itens Solicitados</span>
                <div className="bg-amber-50/50 rounded-xl p-3 space-y-2 border border-amber-100">
                  {pedidoSelecionado.itens.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-800">
                        {it.quantidade}x {it.produto?.nome || 'Item'}
                      </span>
                      <span className="font-mono font-bold text-amber-900">
                        {formatarMoeda(it.preco || (it.produto?.preco || 0) * it.quantidade)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-dashed border-amber-200 pt-3 space-y-1 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatarMoeda(pedidoSelecionado.subtotal)}</span>
                </div>
                {pedidoSelecionado.taxa_entrega > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Taxa de entrega</span>
                    <span>{formatarMoeda(pedidoSelecionado.taxa_entrega)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-amber-950 pt-1">
                  <span>Total</span>
                  <span>{formatarMoeda(pedidoSelecionado.total)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => reImprimirRecibo(pedidoSelecionado)}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 17h2a2 2 0 0 1 2-2v-4a2 2 0 0 1-2-2H5a2 2 0 0 1-2 2v4a2 2 0 0 1 2 2h2m2 4h6a2 2 0 0 1 2-2v-4a2 2 0 0 1-2-2H9a2 2 0 0 1-2 2v4a2 2 0 0 1 2 2zm8-12V5a2 2 0 0 1-2-2H9a2 2 0 0 1-2 2v4h10z"
                  />
                </svg>
                Reimprimir Recibo
              </button>
              <button
                onClick={() => setPedidoSelecionado(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl text-sm transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
