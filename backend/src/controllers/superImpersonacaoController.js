const crypto = require('crypto');
const { prismaBase } = require('../lib/prismaBase');

const CODIGO_TTL_MS = 60 * 1000;

/**
 * Gera um código de uso único (não um token na URL — evita vazar segredo por
 * log de proxy/histórico do navegador/header Referer) pro super admin entrar
 * como um tenant. O código expira em 60s e é resgatado por
 * POST /api/auth/impersonar (rota do lado do tenant, ver routes/auth.js) —
 * um `LogImpersonacao` é aberto aqui, no momento em que o código é emitido,
 * não quando é resgatado (assim mesmo um código nunca resgatado fica auditado).
 */
async function impersonar(req, res) {
  try {
    const { id } = req.params;
    const tenant = await prismaBase.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ erro: 'Tenant não encontrado' });
    }
    if (!tenant.ativo) {
      return res.status(400).json({ erro: 'Tenant está desativado' });
    }

    const codigo = crypto.randomBytes(32).toString('hex');
    await prismaBase.impersonacaoCodigo.create({
      data: {
        codigo,
        superAdminId: req.superAdmin.id,
        tenantId: tenant.id,
        expiraEm: new Date(Date.now() + CODIGO_TTL_MS),
      },
    });
    await prismaBase.logImpersonacao.create({
      data: {
        superAdminId: req.superAdmin.id,
        tenantId: tenant.id,
        ip: req.ip,
      },
    });

    const dominioBase = process.env.DOMINIO_BASE;
    const url = dominioBase
      ? `https://${tenant.slug}.${dominioBase}/admin?codigo=${codigo}`
      : `/admin?codigo=${codigo}&_tenant=${tenant.slug}`;

    res.json({ url, expiraEm: new Date(Date.now() + CODIGO_TTL_MS) });
  } catch (err) {
    console.error('Erro ao gerar impersonation:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Lista o histórico de impersonation — geral ou filtrado por tenant, mais recente primeiro. */
async function listarLogs(req, res) {
  try {
    const { tenantId } = req.query;
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const tamanhoPagina = Math.min(100, Math.max(1, parseInt(req.query.tamanhoPagina, 10) || 20));

    const where = tenantId ? { tenantId: String(tenantId) } : {};
    const [logs, total] = await Promise.all([
      prismaBase.logImpersonacao.findMany({
        where,
        orderBy: { iniciadoEm: 'desc' },
        skip: (pagina - 1) * tamanhoPagina,
        take: tamanhoPagina,
        include: { tenant: { select: { slug: true, nome: true } } },
      }),
      prismaBase.logImpersonacao.count({ where }),
    ]);

    res.json({ logs, total, pagina, tamanhoPagina });
  } catch (err) {
    console.error('Erro ao listar logs de impersonation:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { impersonar, listarLogs };
