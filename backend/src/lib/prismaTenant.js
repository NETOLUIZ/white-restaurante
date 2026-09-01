const { prismaBase } = require('./prismaBase');

// Pivots puras: só existem penduradas em ItemPedido, nunca consultadas isoladamente
// (ver schema.prisma — não têm tenantId). Tenant: o próprio model de tenant não
// pode ser escopado por si mesmo. SuperAdmin (Fase 6A): não pertence a
// nenhum tenant — a extension tentaria injetar tenantId e o Prisma quebraria,
// já que o model nem tem essa coluna. ProdutoCatalogo: catálogo mestre do
// super admin, também sem tenantId — a permissão por tenant vive em
// CatalogoProdutoTenant (esse sim escopado normalmente).
const MODELS_NAO_ESCOPADOS = new Set([
  'ItemPedidoAdicional',
  'ItemPedidoProteina',
  'ItemPedidoComplemento',
  'Tenant',
  'SuperAdmin',
  'ProdutoCatalogo',
]);

// findUnique/findUniqueOrThrow não aceitam tenantId solto no where quando a
// unique virou composta — o Prisma exige a sintaxe tenantId_campo (ex:
// tenantId_email). Em vez de tentar reescrever isso magicamente aqui (frágil
// e silencioso), falhamos alto: cada chamada quebrada vira item da checklist
// da Fase 3, em vez de um vazamento sutil entre tenants.
const OPERACOES_PROIBIDAS = new Set(['findUnique', 'findUniqueOrThrow']);

const OPERACOES_COM_WHERE = new Set([
  'findFirst', 'findFirstOrThrow', 'findMany',
  'update', 'updateMany', 'delete', 'deleteMany',
  'count', 'aggregate', 'groupBy',
]);

/**
 * Fábrica que devolve um Prisma Client escopado a um tenant — todo `where`
 * ganha `tenantId` automaticamente, todo `create`/`createMany`/`upsert` ganha
 * `tenantId` nos dados. Isolamento acontece nesta única camada; os controllers
 * (Fase 3) não precisam (nem podem) filtrar por tenantId manualmente.
 *
 * ⚠️ Só cobre o model raiz da operação — um `pedido.create({ data: { itens:
 * { create: [...] } } })` NÃO injeta tenantId no ItemPedido aninhado. Isso
 * precisa ser passado explicitamente no nested create (ver Fase 3, item c).
 */
function prismaParaTenant(tenantId) {
  if (!tenantId) throw new Error('prismaParaTenant chamado sem tenantId');

  return prismaBase.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (MODELS_NAO_ESCOPADOS.has(model)) return query(args);

          if (OPERACOES_PROIBIDAS.has(operation)) {
            throw new Error(
              `[multitenant] ${model}.${operation}() não é permitido. ` +
              `Use findFirst({ where: { ... } }) — o tenantId é injetado automaticamente.`,
            );
          }

          if (OPERACOES_COM_WHERE.has(operation)) {
            args.where = { ...args.where, tenantId };
          }

          if (operation === 'create') {
            args.data = { ...args.data, tenantId };
          }

          if (operation === 'createMany') {
            const lista = Array.isArray(args.data) ? args.data : [args.data];
            args.data = lista.map((item) => ({ ...item, tenantId }));
          }

          if (operation === 'upsert') {
            args.where = { ...args.where, tenantId };
            args.create = { ...args.create, tenantId };
          }

          return query(args);
        },
      },
    },
  });
}

module.exports = { prismaParaTenant };
