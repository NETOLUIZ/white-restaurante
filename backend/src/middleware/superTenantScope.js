const { prismaBase } = require('../lib/prismaBase');
const { prismaParaTenant } = require('../lib/prismaTenant');

/**
 * Resolve o tenant alvo (req.params.tenantId) e monta um req.prisma escopado
 * a ele — usado pelas rotas de /api/super/tenants/:tenantId/produtos, a
 * exceção deliberada à regra "sem CRUD de conteúdo no super admin" (ver
 * comentário no topo de routes/super.js).
 */
async function resolverTenantAlvo(req, res, next) {
  try {
    const tenant = await prismaBase.tenant.findUnique({ where: { id: req.params.tenantId } });
    if (!tenant) {
      return res.status(404).json({ erro: 'Tenant não encontrado' });
    }
    if (!tenant.ativo) {
      return res.status(400).json({ erro: 'Tenant está desativado' });
    }
    req.tenantId = tenant.id;
    req.tenant = tenant;
    req.prisma = prismaParaTenant(tenant.id);
    next();
  } catch (err) {
    console.error('Erro ao resolver tenant alvo:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { resolverTenantAlvo };
