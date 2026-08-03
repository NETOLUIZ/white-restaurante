const jwt = require('jsonwebtoken');

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
 * Fase 4 — confirma que o token foi emitido PRA este tenant (não só que a
 * assinatura é válida). Sem isso, um admin do tenant A com token válido
 * conseguiria autenticar no subdomínio do tenant B se por acaso existisse um
 * registro com o mesmo id lá — o payload {id, email} sozinho não prova nada
 * sobre qual tenant emitiu o token.
 *
 * Tokens emitidos antes da Fase 4 não têm tenantId — tratados como inválidos
 * direto (sem fallback: um fallback aqui seria buraco de segurança permanente,
 * e não há sessão de produção pra preservar).
 */
function tenantDoTokenBate(payload, req) {
  if (!payload.tenantId || payload.tenantId !== req.tenantId) {
    console.warn(
      `[seguranca] token com tenantId=${payload.tenantId || 'ausente'} usado no subdominio do tenant=${req.tenantId} — rejeitado`,
    );
    return false;
  }
  return true;
}

/**
 * Exige um admin autenticado. O token vem de um cookie httpOnly (nao de
 * localStorage/Authorization header) — assinado no login (authController.js)
 * e lido aqui. Em caso de token ausente/invalido, responde 401 sem detalhar
 * o motivo exato (nao da pista pra quem esta tentando adivinhar).
 *
 * Usa req.prisma (escopado ao tenant pelo middleware resolveTenant, que roda
 * antes deste) — findUnique por id sozinho não é mais aceito pelo client
 * escopado (ver lib/prismaTenant.js), então vira findFirst; o filtro por
 * tenantId é injetado automaticamente pela extension.
 *
 * Fase 6A — também aceita o cookie de impersonation (`ba_impersonacao`,
 * emitido por POST /api/auth/impersonar) como alternativa ao login normal do
 * admin: o super admin "entra como" o tenant sem nunca conhecer a senha de
 * ninguém. Se os dois cookies existirem no mesmo navegador, impersonation tem
 * prioridade — é o cenário deliberado (super admin testando um tenant em que
 * também está logado como admin real). `req.impersonando` fica disponível
 * pros controllers bloquearem ações sensíveis (troca de senha, desativar o
 * próprio tenant) só sob impersonation.
 */
async function autenticarAdmin(req, res, next) {
  const tokenImpersonacao = req.cookies?.ba_impersonacao;
  const tokenAdmin = req.cookies?.ba_admin_token;
  if (!tokenImpersonacao && !tokenAdmin) {
    return res.status(401).json({ erro: 'Nao autenticado' });
  }

  try {
    if (tokenImpersonacao) {
      const payload = jwt.verify(tokenImpersonacao, process.env.JWT_SECRET);
      if (payload.tipo !== 'impersonacao' || !tenantDoTokenBate(payload, req)) {
        return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
      }
      req.admin = { id: null, email: null };
      req.impersonando = true;
      req.superAdminId = payload.superAdminId;
      req.logId = payload.logId;
      return next();
    }

    const payload = jwt.verify(tokenAdmin, process.env.JWT_SECRET);
    if (!tenantDoTokenBate(payload, req)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    const admin = await req.prisma.admin.findFirst({ where: { id: payload.id }, select: { senhaAlteradaEm: true } });
    if (!tokenAindaValido(payload, admin)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    req.admin = { id: payload.id, email: payload.email };
    req.impersonando = false;
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
  const token = req.cookies?.ba_garcom_token;
  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!tenantDoTokenBate(payload, req)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    const garcom = await req.prisma.garcom.findFirst({ where: { id: payload.id }, select: { ativo: true, senhaAlteradaEm: true } });
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
  const token = req.cookies?.ba_entregador_token;
  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!tenantDoTokenBate(payload, req)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    const entregador = await req.prisma.entregador.findFirst({ where: { id: payload.id }, select: { ativo: true, senhaAlteradaEm: true } });
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
  const token = req.cookies?.ba_atendente_token;
  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!tenantDoTokenBate(payload, req)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    const atendente = await req.prisma.atendente.findFirst({ where: { id: payload.id }, select: { ativo: true, senhaAlteradaEm: true } });
    if (!tokenAindaValido(payload, atendente)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    req.atendente = { id: payload.id, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  }
}

/**
 * Exige uma empresa (cliente corporativo, ex: construtora) autenticada —
 * mesmo esquema dos demais papéis (JWT em cookie httpOnly), cookie e payload
 * próprios. Sem acesso a nenhuma outra rota de papel, só ao próprio escopo
 * (cardápio restrito + pedido em lote).
 */
async function autenticarEmpresa(req, res, next) {
  const token = req.cookies?.ba_empresa_token;
  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!tenantDoTokenBate(payload, req)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    const empresa = await req.prisma.empresa.findFirst({ where: { id: payload.id }, select: { ativo: true, senhaAlteradaEm: true } });
    if (!tokenAindaValido(payload, empresa)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    req.empresa = { id: payload.id, login: payload.login };
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  }
}

module.exports = { autenticarAdmin, autenticarGarcom, autenticarEntregador, autenticarAtendente, autenticarEmpresa };
