/**
 * Cliente mínimo do Evolution API (self-hosted, ver docker-compose.yml) —
 * criação de instância, QR Code de conexão, status e envio de texto. Cada
 * tenant tem sua PRÓPRIA instância (Configuracao.whatsappInstancia): a
 * mensagem de confirmação sai do WhatsApp da própria loja, nunca de um
 * número compartilhado.
 *
 * Token global (EVOLUTION_API_KEY) só gerencia instâncias (criar/conectar/
 * status/logout); o token devolvido na criação de cada instância é o único
 * usado pra mandar mensagem por ela (ver enviarMensagem) — mesma separação
 * que a própria Evolution API exige entre os dois tipos de apikey.
 */

const TIMEOUT_MS = 15000;
const BASE_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY || '';

function fetchComTimeout(url, opts = {}) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

/**
 * Erros de negócio da Evolution API (ex: instância desconectada) vêm como
 * `{ status, error: 'Bad Request', response: { message: [...] } }` — o
 * `.error` sozinho só repete o nome genérico do status HTTP ("Bad Request"),
 * o motivo real fica em `.response.message`. Erros de baixo nível (Boom, ex:
 * sessão do WhatsApp caiu) vêm num formato mais simples, com `.message` já
 * na raiz. Sem checar `.response.message` primeiro, o log só mostrava
 * "Bad Request" pra qualquer falha de envio, escondendo a causa real.
 */
function extrairMensagemErro(data, status) {
  const bruta = data && ((data.response && data.response.message) || data.message || data.error);
  const mensagem = Array.isArray(bruta) ? bruta.join('; ') : bruta;
  return mensagem || `Evolution API respondeu ${status}`;
}

async function chamar(path, { method = 'GET', apikey, body } = {}) {
  const res = await fetchComTimeout(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(extrairMensagemErro(data, res.status));
  }
  return data;
}

/** Cria a instância do tenant. Devolve o token (apikey) específico dela. */
async function criarInstancia(instanceName) {
  const data = await chamar('/instance/create', {
    method: 'POST',
    apikey: GLOBAL_API_KEY,
    body: { instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true },
  });
  const token = (data && data.hash && (data.hash.apikey || data.hash)) || null;
  if (!token) throw new Error('Evolution API não devolveu o token da instância');
  return { token };
}

/** QR Code atual pra escanear (base64 já vem como data URI, pronto pra <img src>). */
async function obterQrCode(instanceName) {
  const data = await chamar(`/instance/connect/${encodeURIComponent(instanceName)}`, { apikey: GLOBAL_API_KEY });
  return { base64: (data && data.base64) || null };
}

/** 'open' | 'close' | 'connecting'. */
async function statusConexao(instanceName) {
  const data = await chamar(`/instance/connectionState/${encodeURIComponent(instanceName)}`, { apikey: GLOBAL_API_KEY });
  return (data && data.instance && data.instance.state) || 'close';
}

async function desconectarInstancia(instanceName) {
  await chamar(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: 'DELETE', apikey: GLOBAL_API_KEY });
}

async function enviarMensagem({ instanceName, token, numero, texto }) {
  return chamar(`/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    apikey: token,
    body: { number: numero, text: texto },
  });
}

/** Telefone salvo no pedido é só dígitos, geralmente sem o "55" (DDD+número, 10-11 dígitos). */
function formatarNumeroWhatsapp(telefoneDigitos) {
  const digitos = String(telefoneDigitos || '').replace(/\D/g, '');
  return digitos.length <= 11 ? `55${digitos}` : digitos;
}

module.exports = {
  criarInstancia,
  obterQrCode,
  statusConexao,
  desconectarInstancia,
  enviarMensagem,
  formatarNumeroWhatsapp,
};
