const { prismaBase } = require('../lib/prismaBase');

/**
 * Lista produtos de TODOS os tenants — visão consolidada do super admin
 * (única tela do sistema que enxerga catálogo cross-tenant fora do fluxo de
 * impersonation). Usa prismaBase direto pelo mesmo motivo do superTenantController:
 * super admin não opera dentro do isolamento por tenant.
 * Filtros opcionais via query string:
 *   - tenantId: id do tenant
 *   - busca: termo de busca por nome do produto ou nome/slug da empresa
 *   - ativo: "true" ou "false"
 */
async function listar(req, res) {
  try {
    const { tenantId, busca, ativo } = req.query;
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (ativo === 'true') where.ativo = true;
    if (ativo === 'false') where.ativo = false;
    if (busca) {
      const termo = String(busca).trim();
      where.OR = [
        { nome: { contains: termo, mode: 'insensitive' } },
        { descricaoCurta: { contains: termo, mode: 'insensitive' } },
        { codigoBarras: { contains: termo, mode: 'insensitive' } },
        { tenant: { nome: { contains: termo, mode: 'insensitive' } } },
        { tenant: { slug: { contains: termo, mode: 'insensitive' } } },
      ];
    }

    const produtos = await prismaBase.produto.findMany({
      where,
      select: {
        id: true,
        nome: true,
        preco: true,
        estoque: true,
        ativo: true,
        categoria: { select: { nome: true } },
        tenant: { select: { id: true, nome: true, slug: true, tipo: true } },
      },
      orderBy: [{ tenant: { nome: 'asc' } }, { nome: 'asc' }],
    });
    res.json(produtos);
  } catch (err) {
    console.error('Erro ao listar produtos (super admin):', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listar };
