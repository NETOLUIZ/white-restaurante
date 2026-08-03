// ⚠️ CLIENT SEM ESCOPO DE TENANT.
// Uso permitido APENAS em: seed, resolveTenant, scripts de manutenção.
// NUNCA importe isto em um controller — controllers usam req.prisma
// (ver middleware/resolveTenant.js + lib/prismaTenant.js), que já vem
// escopado ao tenant da requisição.
const { PrismaClient } = require('@prisma/client');
const prismaBase = new PrismaClient();
module.exports = { prismaBase };
