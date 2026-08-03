const { prismaBase } = require('../lib/prismaBase');
const { CHAVES_FEATURE } = require('../utils/tenantFeatures');

/** Lista as features de um tenant — painel do super admin. */
async function listar(req, res) {
  try {
    const { id } = req.params;
    const features = await prismaBase.tenantFeature.findMany({
      where: { tenantId: id },
      orderBy: { chave: 'asc' },
    });
    res.json(features);
  } catch (err) {
    console.error('Erro ao listar features:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Ativa/desativa uma feature de um tenant — cria a linha se ainda não existir. */
async function atualizar(req, res) {
  try {
    const { id, chave } = req.params;
    const { ativo } = req.body;
    if (!CHAVES_FEATURE.includes(chave)) {
      return res.status(400).json({ erro: `Feature desconhecida — use uma de: ${CHAVES_FEATURE.join(', ')}` });
    }
    if (typeof ativo !== 'boolean') {
      return res.status(400).json({ erro: 'Campo "ativo" precisa ser true ou false' });
    }
    const feature = await prismaBase.tenantFeature.upsert({
      where: { tenantId_chave: { tenantId: id, chave } },
      update: { ativo },
      create: { tenantId: id, chave, ativo },
    });
    res.json(feature);
  } catch (err) {
    console.error('Erro ao atualizar feature:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listar, atualizar };
