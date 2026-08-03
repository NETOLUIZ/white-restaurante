const { registrarAuditoria } = require('./auditLogger');

/**
 * Bloqueio por conta, em memoria — complementa o rate limit por IP (server.js).
 * Sem isso, um atacante distribuido (varios IPs) podia tentar senha contra uma
 * unica conta sem nunca bater no limite por IP. Backoff progressivo: cada
 * bloqueio consecutivo dobra a duracao, ate o teto de 15 minutos.
 */
const LIMITE_FALHAS = 5;
const BLOQUEIO_BASE_MS = 30 * 1000;
const BLOQUEIO_MAX_MS = 15 * 60 * 1000; // 15 minutos

const tentativas = new Map();

function normalizar(email) {
  return String(email || '').trim().toLowerCase();
}

/** Segundos restantes de bloqueio, ou null se a conta pode tentar login agora. */
function verificarBloqueio(email) {
  const registro = tentativas.get(normalizar(email));
  if (registro && registro.bloqueadoAte > Date.now()) {
    return Math.ceil((registro.bloqueadoAte - Date.now()) / 1000);
  }
  return null;
}

/** Chamado a cada login/senha incorreta — acumula falha e, a partir do limite, bloqueia com backoff. */
function registrarFalha(email, req) {
  const chave = normalizar(email);
  const registro = tentativas.get(chave) || { falhas: 0, bloqueadoAte: 0 };
  registro.falhas += 1;
  if (registro.falhas >= LIMITE_FALHAS) {
    const excedente = registro.falhas - LIMITE_FALHAS;
    registro.bloqueadoAte = Date.now() + Math.min(BLOQUEIO_BASE_MS * 2 ** excedente, BLOQUEIO_MAX_MS);
    registrarAuditoria({
      acao: 'LOGIN_LOCKOUT',
      ator: email,
      detalhes: { falhas: registro.falhas, bloqueadoSegundos: Math.ceil((registro.bloqueadoAte - Date.now()) / 1000) },
      req,
    });
  }
  tentativas.set(chave, registro);
}

/** Chamado no login bem-sucedido — zera o contador da conta. */
function limparFalhas(email) {
  tentativas.delete(normalizar(email));
}

module.exports = { verificarBloqueio, registrarFalha, limparFalhas };
