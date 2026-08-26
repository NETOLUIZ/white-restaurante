const { prismaBase } = require('../lib/prismaBase');
const { prismaParaTenant } = require('../lib/prismaTenant');

const IP_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Primeiro label do host como slug do tenant, ou null se o host não tem subdomínio válido. */
function extrairSlugDoHost(hostname) {
  if (!hostname) return null;
  if (hostname === 'localhost') return null;
  if (IP_REGEX.test(hostname)) return null;
  const labels = hostname.split('.');
  if (labels.length < 3) return null; // "dominio.com" tem 2 labels — sem subdomínio
  return labels[0];
}

/**
 * Em dev, o hostname quase nunca tem subdomínio real (localhost, 127.0.0.1) —
 * o header vira o mecanismo de teste, e TENANT_DEV_PADRAO cobre o caso comum
 * de abrir o app direto no navegador (nenhum HTML manda esse header — não dá
 * pra alterar o frontend pra isso). Sem TENANT_DEV_PADRAO configurado, dev
 * sem header/subdomínio continua caindo em 400 como antes. Fora de dev os
 * dois são ignorados por completo: senão vira bypass trivial de isolamento
 * entre tenants em produção (real, isso é resolvido só via subdomínio/proxy — Fase 5).
 */
function resolverSlug(req) {
  if (process.env.NODE_ENV === 'development') {
    const header = req.headers['x-tenant-slug'];
    if (header) return String(header).trim().toLowerCase();
    // Tag <img src="...">/<a href="..."> não manda header customizado — só
    // a query string sobrevive numa navegação/carregamento de recurso puro.
    // Mesma convenção ?_tenant= que index.html já usa pra abrir a loja de
    // outro tenant em dev (ver headersExtras lá) — aqui cobre o caso de
    // carregar uma IMAGEM de um tenant que não é o TENANT_DEV_PADRAO.
    const queryTenant = req.query && req.query._tenant;
    if (queryTenant) return String(queryTenant).trim().toLowerCase();
    const doHost = extrairSlugDoHost(req.hostname);
    if (doHost) return doHost;
    if (process.env.TENANT_DEV_PADRAO) return process.env.TENANT_DEV_PADRAO.trim().toLowerCase();
    return null;
  }
  return extrairSlugDoHost(req.hostname);
}

// Cache em memória — sem isso, toda request faz uma query só pra achar o tenant.
// Slugs não encontrados também são cacheados (TTL menor), pra não martelar o
// banco com requests inválidas repetidas (scanner de subdomínio, etc).
const CACHE_TTL_MS = 60 * 1000;
const CACHE_TTL_NAO_ENCONTRADO_MS = 10 * 1000;
const cache = new Map(); // slug -> { tenant: Tenant|null, expiresAt: number }

async function buscarTenantComCache(slug) {
  const cacheado = cache.get(slug);
  if (cacheado && cacheado.expiresAt > Date.now()) {
    return cacheado.tenant;
  }
  const tenant = await prismaBase.tenant.findUnique({ where: { slug } });
  cache.set(slug, {
    tenant,
    expiresAt: Date.now() + (tenant ? CACHE_TTL_MS : CACHE_TTL_NAO_ENCONTRADO_MS),
  });
  return tenant;
}

/**
 * Remove um slug do cache — chamado pelo super admin (Fase 6A) ao
 * ativar/desativar um tenant, pra não esperar até 60s de cache vencer antes
 * de um tenant desativado parar de responder.
 */
function invalidarCacheTenant(slug) {
  cache.delete(slug);
}

/**
 * Resolve o tenant pelo subdomínio e anexa req.tenantId/req.tenant/req.prisma
 * (client já escopado, ver lib/prismaTenant.js) antes de qualquer rota de API
 * ou middleware de autenticação — o auth (Fase 3) precisa de req.prisma pra
 * buscar o usuário já filtrado pelo tenant certo.
 *
 * Fase 6A — subdomínio "super" (super.<DOMINIO_BASE>, ou header
 * x-tenant-slug: super em dev) não é um tenant: é o painel do dono da
 * plataforma. Não existe (nem pode existir) Tenant com esse slug — em vez de
 * tentar achar um e cair em 404, marca req.ehSuperAdmin e segue sem
 * req.tenantId/req.prisma. As rotas /api/super/* usam prismaBase direto
 * (único lugar do sistema autorizado a isso) e exigem req.ehSuperAdmin
 * explicitamente (ver server.js) — senão 404, não 403, pra não confirmar
 * pra quem não deveria saber que esse painel existe.
 *
 * "produtos" (produtos.<DOMINIO_BASE>) é a mesma exceção — tela de cadastro
 * de produto cross-tenant do super admin (ver routes/super.js e
 * produtos.html), também sem Tenant próprio.
 */
async function resolveTenant(req, res, next) {
  try {
    const slug = resolverSlug(req);
    if (!slug) {
      return res.status(400).json({ erro: 'Não foi possível identificar a loja (subdomínio inválido)' });
    }

    if (slug === 'super' || slug === 'produtos') {
      req.ehSuperAdmin = true;
      return next();
    }

    const tenant = await buscarTenantComCache(slug);
    if (!tenant || !tenant.ativo) {
      return res.status(404).json({ erro: 'Loja não encontrada' });
    }

    req.tenantId = tenant.id;
    req.tenant = tenant;
    req.prisma = prismaParaTenant(tenant.id);
    next();
  } catch (err) {
    console.error('Erro ao resolver tenant:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { resolveTenant, invalidarCacheTenant };
