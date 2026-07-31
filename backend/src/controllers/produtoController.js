const { prisma } = require('../utils/db');

/**
 * Lista produtos ativos. Filtros opcionais via query string:
 *   - categoria: id da categoria
 *   - busca: termo de busca por nome/descrição curta (case-insensitive)
 *   - destaque: "true" para só os produtos de destaque ("mais pedidos" da Home)
 */
async function listarPublico(req, res) {
  try {
    const { categoria, busca, destaque } = req.query;
    const where = { ativo: true };
    if (categoria) where.categoriaId = parseInt(categoria, 10);
    if (destaque === 'true') where.destaque = true;
    if (busca) {
      const termo = String(busca).trim();
      where.OR = [
        { nome: { contains: termo, mode: 'insensitive' } },
        { descricaoCurta: { contains: termo, mode: 'insensitive' } },
      ];
    }

    const produtos = await prisma.produto.findMany({
      where,
      include: { adicionais: { where: { ativo: true, esgotado: false }, orderBy: { nome: 'asc' } } },
      orderBy: { nome: 'asc' },
    });
    res.json(produtos);
  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Detalhe de um produto (com a categoria associada) — usado pela tela de Produto. */
async function buscarPorId(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'Id de produto inválido' });
    }
    const produto = await prisma.produto.findFirst({
      where: { id, ativo: true },
      include: { categoria: true, adicionais: { where: { ativo: true, esgotado: false }, orderBy: { nome: 'asc' } } },
    });
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    res.json(produto);
  } catch (err) {
    console.error('Erro ao buscar produto:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Lista TODOS os produtos (inclusive inativos) — painel admin. */
async function listarAdmin(req, res) {
  try {
    const produtos = await prisma.produto.findMany({
      include: { categoria: true, adicionais: { orderBy: { nome: 'asc' } } },
      orderBy: { nome: 'asc' },
    });
    res.json(produtos);
  } catch (err) {
    console.error('Erro ao listar produtos (admin):', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Cria um produto novo — painel admin. */
async function criar(req, res) {
  try {
    const { categoriaId, subcategoriaId, nome, descricaoCurta, descricaoCompleta, preco, avaliacao, tag, destaque, ativo, estoque } = req.body;
    if (!categoriaId || !nome || !descricaoCurta || preco === undefined) {
      return res.status(400).json({ erro: 'Categoria, nome, descrição curta e preço são obrigatórios' });
    }
    const produto = await prisma.produto.create({
      data: {
        categoriaId: parseInt(categoriaId, 10),
        subcategoriaId: subcategoriaId ? parseInt(subcategoriaId, 10) : null,
        nome: String(nome).trim(),
        descricaoCurta: String(descricaoCurta).trim(),
        descricaoCompleta: String(descricaoCompleta || descricaoCurta).trim(),
        preco: Number(preco),
        avaliacao: avaliacao != null ? Number(avaliacao) : null,
        tag: tag || null,
        destaque: Boolean(destaque),
        estoque: estoque !== undefined ? parseInt(estoque, 10) || 0 : 0,
        ativo: ativo === undefined ? true : Boolean(ativo),
      },
      include: { adicionais: true },
    });
    res.status(201).json(produto);
  } catch (err) {
    console.error('Erro ao criar produto:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza um produto — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { categoriaId, subcategoriaId, nome, descricaoCurta, descricaoCompleta, preco, avaliacao, tag, destaque, ativo, estoque } = req.body;
    const data = {};
    if (categoriaId !== undefined) data.categoriaId = parseInt(categoriaId, 10);
    if (subcategoriaId !== undefined) data.subcategoriaId = subcategoriaId ? parseInt(subcategoriaId, 10) : null;
    if (nome !== undefined) data.nome = String(nome).trim();
    if (descricaoCurta !== undefined) data.descricaoCurta = String(descricaoCurta).trim();
    if (descricaoCompleta !== undefined) data.descricaoCompleta = String(descricaoCompleta).trim();
    if (preco !== undefined) data.preco = Number(preco);
    if (avaliacao !== undefined) data.avaliacao = avaliacao === null ? null : Number(avaliacao);
    if (tag !== undefined) data.tag = tag || null;
    if (destaque !== undefined) data.destaque = Boolean(destaque);
    if (estoque !== undefined) data.estoque = Math.max(0, parseInt(estoque, 10) || 0);
    if (ativo !== undefined) data.ativo = Boolean(ativo);

    const produto = await prisma.produto.update({ where: { id }, data, include: { adicionais: true } });
    res.json(produto);
  } catch (err) {
    console.error('Erro ao atualizar produto:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Soma `delta` (pode ser negativo) ao estoque do produto, sem deixar passar de 0 — painel admin. */
async function ajustarEstoque(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const delta = parseInt(req.body.delta, 10) || 0;
    const atual = await prisma.produto.findUnique({ where: { id } });
    if (!atual) return res.status(404).json({ erro: 'Produto não encontrado' });
    const produto = await prisma.produto.update({ where: { id }, data: { estoque: Math.max(0, atual.estoque + delta) }, include: { adicionais: true } });
    res.json(produto);
  } catch (err) {
    console.error('Erro ao ajustar estoque:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Remove um produto — painel admin. */
async function deletar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.produto.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(409).json({ erro: 'Esse produto já está em pedidos — desative em vez de remover' });
    }
    console.error('Erro ao remover produto:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Recebe a foto do produto via multipart/form-data (campo "foto", ver multer
 * em routes/admin.js) e salva só o caminho relativo no banco — o arquivo em
 * si fica em /uploads/produtos, nunca como base64 numa coluna.
 */
async function enviarFoto(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo de imagem enviado' });
    }
    const caminhoRelativo = `produtos/${req.file.filename}`;
    const produto = await prisma.produto.update({ where: { id }, data: { foto: caminhoRelativo }, include: { adicionais: true } });
    res.json({ foto: `/uploads/${caminhoRelativo}`, produto });
  } catch (err) {
    console.error('Erro ao salvar foto do produto:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Remove a foto do produto (volta a usar o placeholder no front) — painel admin. */
async function removerFoto(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const produto = await prisma.produto.update({ where: { id }, data: { foto: null }, include: { adicionais: true } });
    res.json({ produto });
  } catch (err) {
    console.error('Erro ao remover foto do produto:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listarPublico, buscarPorId, listarAdmin, criar, atualizar, deletar, enviarFoto, removerFoto, ajustarEstoque };
