const path = require('path');
const fs = require('fs');

/** Lista os banners ativos, ordenados — usado pelo carrossel de promoções da Home. */
async function listarPublico(req, res) {
  try {
    const banners = await req.prisma.banner.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    });
    res.json(banners);
  } catch (err) {
    console.error('Erro ao listar banners:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Lista todos os banners (inclusive inativos) — painel admin. */
async function listarAdmin(req, res) {
  try {
    const banners = await req.prisma.banner.findMany({
      include: { produto: { select: { id: true, nome: true } } },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    });
    res.json(banners);
  } catch (err) {
    console.error('Erro ao listar banners (admin):', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Cria um banner novo — painel admin. */
async function criar(req, res) {
  try {
    const { selo, titulo, descricao, ctaLabel, ctaTipo, produtoId, ordem, ativo } = req.body;
    const banner = await req.prisma.banner.create({
      data: {
        selo: selo ? String(selo).trim() : 'Promo',
        titulo: titulo ? String(titulo).trim() : 'Novo Banner',
        descricao: descricao ? String(descricao).trim() : '',
        ctaLabel: ctaLabel ? String(ctaLabel).trim() : 'Ver mais',
        ctaTipo: ctaTipo || 'CARDAPIO',
        produtoId: ctaTipo === 'PRODUTO' && produtoId ? parseInt(produtoId, 10) : null,
        ordem: Number(ordem) || 0,
        ativo: ativo === undefined ? true : Boolean(ativo),
      },
    });
    res.status(201).json(banner);
  } catch (err) {
    console.error('Erro ao criar banner:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza um banner — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { selo, titulo, descricao, ctaLabel, ctaTipo, produtoId, ordem, ativo } = req.body;
    const data = {};
    if (selo !== undefined) data.selo = selo;
    if (titulo !== undefined) data.titulo = titulo;
    if (descricao !== undefined) data.descricao = descricao;
    if (ctaLabel !== undefined) data.ctaLabel = ctaLabel;
    if (ctaTipo !== undefined) data.ctaTipo = ctaTipo;
    if (produtoId !== undefined) data.produtoId = produtoId ? parseInt(produtoId, 10) : null;
    if (ordem !== undefined) data.ordem = Number(ordem);
    if (ativo !== undefined) data.ativo = Boolean(ativo);

    const banner = await req.prisma.banner.update({ where: { id }, data });
    res.json(banner);
  } catch (err) {
    console.error('Erro ao atualizar banner:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Remove um banner — painel admin. */
async function deletar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await req.prisma.banner.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao remover banner:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Recebe a foto do banner via multipart/form-data (campo "foto", ver multer
 * em routes/admin.js) e salva só o caminho relativo no banco — o arquivo em
 * si fica em /uploads/{tenantId}/banners, nunca como base64 numa coluna.
 */
async function enviarFoto(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo de imagem enviado' });
    }
    // Prefixo com tenantId — ver mesmo comentário em produtoController.enviarFoto.
    const caminhoRelativo = `${req.tenantId}/banners/${req.file.filename}`;
    const banner = await req.prisma.banner.update({ where: { id }, data: { foto: caminhoRelativo } });
    res.json({ foto: `/uploads/${caminhoRelativo}`, banner });
  } catch (err) {
    console.error('Erro ao salvar foto do banner:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Remove a foto do banner: apaga o arquivo em disco e limpa o campo `foto` no banco.
 * Falha no unlink é apenas um aviso — o campo no banco é limpo de qualquer forma.
 */
async function removerFoto(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const banner = await req.prisma.banner.findFirst({ where: { id }, select: { foto: true } });
    if (!banner) return res.status(404).json({ erro: 'Banner não encontrado' });

    // Apaga o arquivo em disco se existir
    if (banner.foto) {
      const caminhoArquivo = path.join(__dirname, '..', '..', 'uploads', banner.foto);
      fs.unlink(caminhoArquivo, (unlinkErr) => {
        if (unlinkErr) console.warn('Aviso: não foi possível deletar arquivo do banner:', unlinkErr.message);
      });
    }

    const bannerAtualizado = await req.prisma.banner.update({ where: { id }, data: { foto: null } });
    res.json({ banner: bannerAtualizado });
  } catch (err) {
    console.error('Erro ao remover foto do banner:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listarPublico, listarAdmin, criar, atualizar, deletar, enviarFoto, removerFoto };
