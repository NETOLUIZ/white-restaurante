/**
 * Fase 6B — bloqueia uma rota inteira quando a feature está desligada pro
 * tenant atual. Esconder botão no frontend não protege nada por si só; isso
 * é a proteção de verdade. Fail-closed: linha ausente é tratada como
 * desativada (toda criação de tenant já cria as 5 features, então ausência é
 * anomalia, não caso normal — ver superTenantController.criar/criar-tenant.js).
 */
function exigirFeature(chave) {
  return async function (req, res, next) {
    try {
      const feature = await req.prisma.tenantFeature.findFirst({ where: { chave } });
      if (!feature || !feature.ativo) {
        return res.status(403).json({ erro: 'Funcionalidade desativada para esta loja' });
      }
      next();
    } catch (err) {
      console.error('Erro ao checar feature:', err);
      res.status(500).json({ erro: 'Erro interno do servidor' });
    }
  };
}

module.exports = { exigirFeature };
