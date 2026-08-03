const { prismaBase } = require('../lib/prismaBase');
const { montarDadosBranding, ErroValidacaoBranding, comUrlsCompletas } = require('../utils/branding');
const { calcularContrasteBranding } = require('../utils/contraste');

/** Lê o branding de um tenant — painel do super admin. */
async function obter(req, res) {
  try {
    const { id } = req.params;
    const branding = await prismaBase.tenantBranding.findUnique({ where: { tenantId: id } });
    if (!branding) {
      return res.status(404).json({ erro: 'Branding não encontrado para este tenant' });
    }
    res.json({ branding: comUrlsCompletas(branding), contraste: calcularContrasteBranding(branding) });
  } catch (err) {
    console.error('Erro ao obter branding:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Atualiza o branding de um tenant — painel do super admin. Cor/fonte
 * inválida vira 400; contraste baixo NUNCA bloqueia o save, só é devolvido
 * como aviso (ver utils/contraste.js).
 */
async function atualizar(req, res) {
  try {
    const { id } = req.params;
    let data;
    try {
      data = montarDadosBranding(req.body);
    } catch (err) {
      if (err instanceof ErroValidacaoBranding) {
        return res.status(400).json({ erro: err.message });
      }
      throw err;
    }

    const atualizado = await prismaBase.tenantBranding.upsert({
      where: { tenantId: id },
      update: data,
      create: { tenantId: id, ...data },
    });
    res.json({ branding: comUrlsCompletas(atualizado), contraste: calcularContrasteBranding(atualizado) });
  } catch (err) {
    console.error('Erro ao atualizar branding:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Recebe a logo (multipart/form-data, campo "logo") e salva o caminho relativo no TenantBranding. */
async function enviarLogo(req, res) {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo de imagem enviado' });
    }
    const caminhoRelativo = `${id}/branding/${req.file.filename}`;
    const branding = await prismaBase.tenantBranding.upsert({
      where: { tenantId: id },
      update: { logoUrl: caminhoRelativo },
      create: { tenantId: id, logoUrl: caminhoRelativo },
    });
    res.json({ branding: comUrlsCompletas(branding) });
  } catch (err) {
    console.error('Erro ao salvar logo:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { obter, atualizar, enviarLogo };
