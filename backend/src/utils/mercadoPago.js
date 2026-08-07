/**
 * Cliente mínimo da API de Pagamentos do Mercado Pago — só o necessário pra
 * cobrança PIX (criar + consultar status). Cada tenant usa o PRÓPRIO Access
 * Token (Configuracao.mercadoPagoAccessToken, gerado no painel dele mesmo do
 * Mercado Pago) — o dinheiro cai direto na conta do tenant, esta plataforma
 * nunca é intermediária.
 */

const TIMEOUT_MS = 10000;
const API_BASE = 'https://api.mercadopago.com/v1/payments';

function fetchComTimeout(url, opts = {}) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

/**
 * Cria uma cobrança PIX dinâmica pro valor exato do pedido. `idempotencyKey`
 * deve ser estável por pedido (ex: o codigoAcompanhamento) — se a requisição
 * for repetida (retry de rede), o Mercado Pago devolve a MESMA cobrança em
 * vez de criar uma segunda cobrada do cliente.
 * Devolve { id, status, qrCode (copia e cola), qrCodeBase64 (imagem PNG) }.
 */
async function criarPagamentoPix({ accessToken, valor, descricao, externalReference, payerEmail, idempotencyKey, notificationUrl }) {
  const res = await fetchComTimeout(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: Math.round(valor * 100) / 100,
      description: descricao,
      payment_method_id: 'pix',
      payer: { email: payerEmail },
      external_reference: externalReference,
      notification_url: notificationUrl,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Mercado Pago respondeu ${res.status}`;
    throw new Error(msg);
  }

  const txData = data.point_of_interaction?.transaction_data || {};
  return {
    id: String(data.id),
    status: data.status,
    qrCode: txData.qr_code || null,
    qrCodeBase64: txData.qr_code_base64 || null,
  };
}

/** Consulta o status atual de um pagamento — nunca confiar só no corpo do webhook, sempre reconsultar aqui. */
async function consultarPagamento({ accessToken, paymentId }) {
  const res = await fetchComTimeout(`${API_BASE}/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Mercado Pago respondeu ${res.status}`;
    throw new Error(msg);
  }
  return { id: String(data.id), status: data.status, externalReference: data.external_reference || null };
}

module.exports = { criarPagamentoPix, consultarPagamento };
