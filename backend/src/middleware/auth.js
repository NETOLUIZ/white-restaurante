const jwt = require('jsonwebtoken');
const { prisma } = require('../utils/db');

/**
 * Um token so e aceito se foi emitido (iat) depois da ultima troca de senha
 * e, quando o papel tem o campo `ativo`, se a conta continua ativa — sem
 * isso, logout/troca de senha/desativacao nao revogavam sessoes ja emitidas
 * (o JWT ficava valido ate as 12h expirarem sozinhas).
 */
function tokenAindaValido(payload, registro) {
  if (!registro) return false;
  if (registro.ativo === false) return false;
  if (registro.senhaAlteradaEm && payload.iat * 1000 < registro.senhaAlteradaEm.getTime()) return false;
  return true;
}

/**
 * Exige um admin autenticado. O token vem de um cookie httpOnly (nao de
 * localStorage/Authorization header) — assinado no login (authController.js)
 * e lido aqui. Em caso de token ausente/invalido, responde 401 sem detalhar
 * o motivo exato (nao da pista pra quem esta tentando adivinhar).
 */
async function autenticarAdmin(req, res, next) {
  const token = req.cookies?.bel_do_frango_atu_admin_token;
  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await prisma.admin.findUnique({ where: { id: payload.id }, select: { senhaAlteradaEm: true } });
    if (!tokenAindaValido(payload, admin)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    req.admin = { id: payload.id, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  }
}

/**
 * Exige um garçom autenticado — mesmo esquema do admin (JWT em cookie
 * httpOnly), mas com cookie e payload próprios. Garçom nunca tem acesso
 * às rotas /api/admin/*, só às /api/garcom/* (escopo: mesas + comanda).
 */
async function autenticarGarcom(req, res, next) {
  const token = req.cookies?.bel_do_frango_atu_garcom_token;
  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const garcom = await prisma.garcom.findUnique({ where: { id: payload.id }, select: { ativo: true, senhaAlteradaEm: true } });
    if (!tokenAindaValido(payload, garcom)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    req.garcom = { id: payload.id, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  }
}

/**
 * Exige um entregador autenticado — mesmo esquema do admin/garçom (JWT em
 * cookie httpOnly), cookie e payload próprios. Sem acesso a /api/admin/* nem /api/garcom/*.
 */
async function autenticarEntregador(req, res, next) {
  const token = req.cookies?.bel_do_frango_atu_entregador_token;
  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const entregador = await prisma.entregador.findUnique({ where: { id: payload.id }, select: { ativo: true, senhaAlteradaEm: true } });
    if (!tokenAindaValido(payload, entregador)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    req.entregador = { id: payload.id, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  }
}

/**
 * Exige um atendente autenticado — mesmo esquema do admin/garçom (JWT em
 * cookie httpOnly), cookie e payload próprios. Sem acesso a /api/admin/*,
 * /api/garcom/* nem /api/entregador/*, só ao próprio escopo (criar pedido de balcão).
 */
async function autenticarAtendente(req, res, next) {
  const token = req.cookies?.bel_do_frango_atu_atendente_token;
  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const atendente = await prisma.atendente.findUnique({ where: { id: payload.id }, select: { ativo: true, senhaAlteradaEm: true } });
    if (!tokenAindaValido(payload, atendente)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    req.atendente = { id: payload.id, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  }
}

module.exports = { autenticarAdmin, autenticarGarcom, autenticarEntregador, autenticarAtendente };
