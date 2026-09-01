const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

/** Lista os itens do catálogo mestre liberados pelo super admin pro tenant logado. */
async function listar(req, res) {
  try {
    const liberados = await req.prisma.catalogoProdutoTenant.findMany({
      include: { catalogoProduto: true },
      orderBy: { catalogoProduto: { nome: 'asc' } },
    });
    res.json(liberados.map((l) => l.catalogoProduto));
  } catch (err) {
    console.error('Erro ao listar catálogo do tenant:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Importa um item do catálogo pro tenant logado — cria um Produto novo com
 * os dados copiados (nome, descrição, preço, foto). Categoria é sempre
 * escolhida pelo tenant, já que CategoriaProduto é por tenant.
 */
async function importar(req, res) {
  try {
    const catalogoProdutoId = parseInt(req.params.catalogoProdutoId, 10);
    const { categoriaId, subcategoriaId } = req.body;
    const catId = parseInt(categoriaId, 10);
    if (!Number.isInteger(catId)) {
      return res.status(400).json({ erro: 'Escolha uma categoria pra importar o produto' });
    }

    const liberado = await req.prisma.catalogoProdutoTenant.findFirst({ where: { catalogoProdutoId } });
    if (!liberado) {
      return res.status(404).json({ erro: 'Item do catálogo não encontrado ou não liberado pro seu tenant' });
    }
    const categoria = await req.prisma.categoriaProduto.findFirst({ where: { id: catId } });
    if (!categoria) {
      return res.status(400).json({ erro: 'Categoria inválida' });
    }

    const item = await req.prisma.produtoCatalogo.findUnique({ where: { id: catalogoProdutoId } });

    let foto = null;
    if (item.foto) {
      const extensao = path.extname(item.foto) || '.webp';
      const nomeArquivo = `${crypto.randomBytes(16).toString('hex')}${extensao}`;
      const destinoDir = path.join(UPLOADS_DIR, req.tenantId, 'produtos');
      await fs.mkdir(destinoDir, { recursive: true });
      await fs.copyFile(path.join(UPLOADS_DIR, item.foto), path.join(destinoDir, nomeArquivo));
      foto = `${req.tenantId}/produtos/${nomeArquivo}`;
    }

    const produto = await req.prisma.produto.create({
      data: {
        categoriaId: catId,
        subcategoriaId: subcategoriaId ? parseInt(subcategoriaId, 10) : null,
        nome: item.nome,
        descricaoCurta: item.descricaoCurta,
        descricaoCompleta: item.descricaoCompleta,
        preco: item.preco ?? 0,
        codigoBarras: item.codigoBarras,
        tag: item.tag,
        foto,
      },
      include: { adicionais: true },
    });
    res.status(201).json(produto);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(400).json({ erro: 'Foto do item do catálogo não encontrada no disco' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um produto com esse código de barras no seu catálogo' });
    }
    console.error('Erro ao importar produto do catálogo:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listar, importar };
