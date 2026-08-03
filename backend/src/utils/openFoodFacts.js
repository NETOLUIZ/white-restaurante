/**
 * Cliente da Open Food Facts (https://openfoodfacts.org) — base ABERTA de
 * produtos alimentícios mantida por voluntários, consultada por código de
 * barras pra agilizar o cadastro de produto no Admin (tenant MERCANTIL):
 * nome, marca e foto vêm preenchidos em vez de digitados à mão.
 *
 * Sem chave de API — a doc pede só um User-Agent identificável e uso moderado
 * (a consulta aqui é 1 request por clique do admin, nunca em loop).
 */

const TIMEOUT_MS = 8000;
const USER_AGENT = 'BelDoFrangoATU/1.0 (painel admin; uso: autofill de cadastro de produto)';

// Só imagens servidas pela própria Open Food Facts podem ser importadas pro
// produto — a URL chega do frontend e sem este allowlist o endpoint viraria
// um proxy de download arbitrário (SSRF) pra dentro do servidor.
const HOSTS_IMAGEM_PERMITIDOS = new Set(['images.openfoodfacts.org', 'static.openfoodfacts.org']);
const TAMANHO_MAX_IMAGEM = 5 * 1024 * 1024; // mesmo limite de upload manual (utils/upload.js)

function fetchComTimeout(url, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: { 'User-Agent': USER_AGENT, ...(opts.headers || {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * Busca um produto pelo código de barras (EAN-8..EAN-14, só dígitos).
 * Devolve { nome, marca, quantidade, imagemUrl } ou null se não encontrado.
 */
async function buscarPorCodigoBarras(codigo) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${codigo}.json`
    + '?fields=product_name,product_name_pt,brands,quantity,image_front_url';
  const res = await fetchComTimeout(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts respondeu ${res.status}`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const nome = (p.product_name_pt || p.product_name || '').trim();
  if (!nome) return null;
  return {
    nome,
    marca: (p.brands || '').trim() || null,
    quantidade: (p.quantity || '').trim() || null,
    imagemUrl: p.image_front_url || null,
  };
}

/**
 * Baixa uma imagem da Open Food Facts (host validado) e devolve o Buffer.
 * Lança Error com `codigo: 'URL_INVALIDA'` pra URL fora do allowlist —
 * o controller converte isso em 400 em vez de 500.
 */
async function baixarImagem(urlImagem) {
  let parsed;
  try {
    parsed = new URL(urlImagem);
  } catch {
    const err = new Error('URL de imagem inválida');
    err.codigo = 'URL_INVALIDA';
    throw err;
  }
  if (parsed.protocol !== 'https:' || !HOSTS_IMAGEM_PERMITIDOS.has(parsed.hostname)) {
    const err = new Error('Só imagens da Open Food Facts podem ser importadas');
    err.codigo = 'URL_INVALIDA';
    throw err;
  }

  const res = await fetchComTimeout(urlImagem);
  if (!res.ok) throw new Error(`Download da imagem falhou (${res.status})`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error('A URL não aponta pra uma imagem');

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > TAMANHO_MAX_IMAGEM) throw new Error('Imagem excede o limite de 5MB');
  return buffer;
}

module.exports = { buscarPorCodigoBarras, baixarImagem };
