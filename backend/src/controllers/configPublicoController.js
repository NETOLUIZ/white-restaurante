const { montarDadosBranding, ErroValidacaoBranding, comUrlsCompletas } = require('../utils/branding');
const { calcularContrasteBranding } = require('../utils/contraste');

/**
 * Endpoint público (sem autenticação) — tudo que o frontend do tenant precisa
 * pra montar a página antes do primeiro paint (nome da loja, branding, quais
 * features estão ligadas). Cacheado por 60s: não é dado sensível, e evita
 * bater no banco a cada carregamento de página.
 */
async function obterPublico(req, res) {
  try {
    const [branding, features] = await Promise.all([
      req.prisma.tenantBranding.upsert({ where: {}, update: {}, create: {} }),
      req.prisma.tenantFeature.findMany({}),
    ]);

    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      tenant: { nome: req.tenant.nome, slug: req.tenant.slug, tipo: req.tenant.tipo },
      branding: comUrlsCompletas(branding),
      features: Object.fromEntries(features.map((f) => [f.chave, f.ativo])),
    });
  } catch (err) {
    console.error('Erro ao obter config pública:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Edita o branding pelo lado do tenant — só acessível durante impersonation
 * (ver exigirImpersonando em routes/config.js). O super admin edita a marca
 * "de dentro" do admin do tenant em vez de ter uma tela de edição de cores
 * separada no próprio painel super, então esta rota (não a de
 * /api/super/tenants/:id/branding) é a que a Fase 6B vai usar.
 */
async function atualizarBranding(req, res) {
  try {
    let data;
    try {
      data = montarDadosBranding(req.body);
    } catch (err) {
      if (err instanceof ErroValidacaoBranding) {
        return res.status(400).json({ erro: err.message });
      }
      throw err;
    }

    const atualizado = await req.prisma.tenantBranding.upsert({ where: {}, update: data, create: data });
    res.json({ branding: comUrlsCompletas(atualizado), contraste: calcularContrasteBranding(atualizado) });
  } catch (err) {
    console.error('Erro ao atualizar branding:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { obterPublico, atualizarBranding };
