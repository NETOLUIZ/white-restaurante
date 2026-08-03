const jwt = require('jsonwebtoken');
const { prismaBase } = require('../lib/prismaBase');

/**
 * Mesmo esquema de tokenAindaValido() de middleware/auth.js — token só vale
 * se emitido depois da última troca de senha e a conta continua ativa.
 * Duplicado aqui (não importado de auth.js) porque os dois módulos precisam
 * ficar independentes: super admin NUNCA deve importar nada que dependa de
 * req.prisma (client escopado a tenant) — usa prismaBase direto o tempo todo.
 */
function tokenAindaValido(payload, registro) {
  if (!registro) return false;
  if (registro.ativo === false) return false;
  if (registro.senhaAlteradaEm && payload.iat * 1000 < registro.senhaAlteradaEm.getTime()) return false;
  return true;
}

/**
 * Exige um super admin autenticado. Cookie e payload próprios, TTL de 2h
 * (menor que os 12h dos demais papéis — é a conta com mais poder do
 * sistema, enxerga e opera como qualquer tenant). `payload.tipo` precisa
 * ser exatamente 'super' — assim um cookie de impersonation (tipo:
 * 'impersonacao', ver middleware/auth.js) nunca é aceito aqui por engano,
 * mesmo que alguém tente reenviá-lo nesta rota.
 */
async function autenticarSuperAdmin(req, res, next) {
  const token = req.cookies?.ba_super_token;
  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.tipo !== 'super') {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    const superAdmin = await prismaBase.superAdmin.findUnique({
      where: { id: payload.id },
      select: { ativo: true, senhaAlteradaEm: true },
    });
    if (!tokenAindaValido(payload, superAdmin)) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
    }
    req.superAdmin = { id: payload.id, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  }
}

module.exports = { autenticarSuperAdmin };
