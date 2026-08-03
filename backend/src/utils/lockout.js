/**
 * Gerenciador em memória de lockout de login.
 * Bloqueia tentativas de login por 15 minutos (900s) após 5 falhas consecutivas para a mesma chave (ex: IP:email).
 */
const falhasPorChave = new Map();
const bloqueiosPorChave = new Map();

const MAX_FALHAS = 5;
const TEMPO_BLOQUEIO_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Limpa registros antigos expirados para liberar memória.
 */
setInterval(() => {
  const agora = Date.now();
  for (const [chave, expiraEm] of bloqueiosPorChave.entries()) {
    if (agora >= expiraEm) {
      bloqueiosPorChave.delete(chave);
      falhasPorChave.delete(chave);
    }
  }
}, 5 * 60 * 1000);

function obterChave(req, identificador) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  return `${ip}:${String(identificador || '').trim().toLowerCase()}`;
}

/**
 * Verifica se a chave está atualmente bloqueada por excesso de falhas.
 * @returns {{ bloqueado: boolean, segundosRestantes?: number }}
 */
function verificarLockout(req, identificador) {
  const chave = obterChave(req, identificador);
  const expiraEm = bloqueiosPorChave.get(chave);
  if (expiraEm) {
    const agora = Date.now();
    if (agora < expiraEm) {
      const segundosRestantes = Math.ceil((expiraEm - agora) / 1000);
      return { bloqueado: true, segundosRestantes };
    }
    bloqueiosPorChave.delete(chave);
    falhasPorChave.delete(chave);
  }
  return { bloqueado: false };
}

/**
 * Registra uma tentativa de login com falha. Se atingir MAX_FALHAS, ativa o lockout.
 */
function registrarFalhaLogin(req, identificador) {
  const chave = obterChave(req, identificador);
  const contagem = (falhasPorChave.get(chave) || 0) + 1;
  falhasPorChave.set(chave, contagem);

  if (contagem >= MAX_FALHAS) {
    bloqueiosPorChave.set(chave, Date.now() + TEMPO_BLOQUEIO_MS);
    console.warn(`[seguranca] Lockout ativado para ${chave} por ${TEMPO_BLOQUEIO_MS / 1000}s após ${contagem} falhas seguidas`);
  }
}

/**
 * Reseta a contagem de falhas em caso de login bem-sucedido.
 */
function resetarFalhasLogin(req, identificador) {
  const chave = obterChave(req, identificador);
  falhasPorChave.delete(chave);
  bloqueiosPorChave.delete(chave);
}

module.exports = {
  verificarLockout,
  registrarFalhaLogin,
  resetarFalhasLogin,
};
