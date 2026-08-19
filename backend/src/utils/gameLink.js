const crypto = require('crypto');

const GAME_SECRET = process.env.GAME_JWT_SECRET || 'saas_pipes_internal_secure_hmac_secret_2026';

/**
 * Gera a URL assinada com JWT HMAC-SHA256 para integração do cliente com o jogo.
 * @param {Object} pedido - Objeto ou dados do pedido
 * @param {Object} [cliente] - Objeto ou dados do cliente (opcional)
 * @param {Object} loja - Objeto da loja / tenant
 * @returns {string} URL com o token JWT para o jogo
 */
function gerarLinkDoJogo(pedido, cliente, loja) {
  const payload = {
    tenantId: String(loja?.id || ''),
    tenantType: (loja?.tipo === 'mercantil' || loja?.tipo === 'MERCANTIL') ? 'MERCANTIL' : 'RESTAURANTE',
    tenantName: loja?.nome_fantasia || loja?.nome || 'Restaurante',
    tenantLogoUrl: loja?.logo_url || loja?.logoUrl || null,
    role: cliente ? 'CUSTOMER' : 'GUEST',
    customerId: cliente ? String(cliente.id) : undefined,
    customerName: cliente ? (cliente.nome || cliente.name) : undefined,
    orderPublicId: pedido?.codigo_publico || pedido?.codigoAcompanhamento || `ORD-${pedido?.id || '0'}`,
    orderNumber: `#${pedido?.numero_pedido || pedido?.id || '0'}`,
    orderStatus: (pedido?.status === 'separando' || pedido?.statusEntrega === 'SEPARANDO') ? 'SEPARANDO' : 'PREPARANDO',
    issuedAt: Date.now(),
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', GAME_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `https://jogo.temnaarea.site/?token=${header}.${body}.${signature}`;
}

module.exports = { gerarLinkDoJogo };
