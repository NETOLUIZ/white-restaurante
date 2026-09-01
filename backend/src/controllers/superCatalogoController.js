const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { prismaBase } = require('../lib/prismaBase');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

/** Lista o catálogo mestre com os tenants que já têm acesso a cada item. */
async function listar(req, res) {
  try {
    const itens = await prismaBase.produtoCatalogo.findMany({
      include: { tenants: { include: { tenant: { select: { id: true, nome: true, slug: true, tipo: true } } } } },
      orderBy: { nome: 'asc' },
    });
    res.json(itens);
  } catch (err) {
    console.error('Erro ao listar catálogo:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Promove um produto já existente de algum tenant pro catálogo mestre —
 * copia os dados e a foto (se houver) pra uma cópia independente em
 * uploads/catalogo/produtos, sem vínculo com o produto de origem.
 */
async function promover(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const produto = await prismaBase.produto.findUnique({ where: { id } });
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    let foto = null;
    if (produto.foto) {
      const extensao = path.extname(produto.foto) || '.webp';
      const nomeArquivo = `${crypto.randomBytes(16).toString('hex')}${extensao}`;
      const destinoDir = path.join(UPLOADS_DIR, 'catalogo', 'produtos');
      await fs.mkdir(destinoDir, { recursive: true });
      await fs.copyFile(path.join(UPLOADS_DIR, produto.foto), path.join(destinoDir, nomeArquivo));
      foto = `catalogo/produtos/${nomeArquivo}`;
    }

    const item = await prismaBase.produtoCatalogo.create({
      data: {
        nome: produto.nome,
        descricaoCurta: produto.descricaoCurta,
        descricaoCompleta: produto.descricaoCompleta,
        preco: produto.preco,
        codigoBarras: produto.codigoBarras,
        tag: produto.tag,
        foto,
      },
    });
    res.status(201).json(item);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(400).json({ erro: 'Foto do produto de origem não encontrada no disco' });
    }
    console.error('Erro ao promover produto pro catálogo:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Edita um item do catálogo mestre diretamente (não afeta produtos já importados). */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { nome, descricaoCurta, descricaoCompleta, preco, codigoBarras, tag } = req.body;
    const item = await prismaBase.produtoCatalogo.update({
      where: { id },
      data: {
        ...(nome !== undefined && { nome: String(nome).trim() }),
        ...(descricaoCurta !== undefined && { descricaoCurta: String(descricaoCurta).trim() }),
        ...(descricaoCompleta !== undefined && { descricaoCompleta: String(descricaoCompleta).trim() }),
        ...(preco !== undefined && { preco: preco === null || preco === '' ? null : Number(preco) }),
        ...(codigoBarras !== undefined && { codigoBarras: codigoBarras || null }),
        ...(tag !== undefined && { tag: tag || null }),
      },
    });
    res.json(item);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ erro: 'Item do catálogo não encontrado' });
    }
    console.error('Erro ao atualizar item do catálogo:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

async function deletar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await prismaBase.produtoCatalogo.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ erro: 'Item do catálogo não encontrado' });
    }
    console.error('Erro ao remover item do catálogo:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

async function enviarFoto(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo de imagem enviado' });
    }
    const foto = `catalogo/produtos/${req.file.filename}`;
    const item = await prismaBase.produtoCatalogo.update({ where: { id }, data: { foto } });
    res.json({ foto: `/uploads/${foto}`, item });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ erro: 'Item do catálogo não encontrado' });
    }
    console.error('Erro ao salvar foto do catálogo:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Libera (ativo=true) ou revoga (ativo=false) o acesso de um tenant a um
 * item do catálogo — a existência da linha em CatalogoProdutoTenant É a
 * permissão, sem flag "ativo" no banco (ver schema.prisma).
 */
async function atualizarTenant(req, res) {
  try {
    const catalogoProdutoId = parseInt(req.params.id, 10);
    const { tenantId } = req.params;
    const { ativo } = req.body;
    if (typeof ativo !== 'boolean') {
      return res.status(400).json({ erro: 'Campo "ativo" precisa ser true ou false' });
    }

    if (ativo) {
      await prismaBase.catalogoProdutoTenant.upsert({
        where: { catalogoProdutoId_tenantId: { catalogoProdutoId, tenantId } },
        update: {},
        create: { catalogoProdutoId, tenantId },
      });
    } else {
      await prismaBase.catalogoProdutoTenant.deleteMany({ where: { catalogoProdutoId, tenantId } });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao atualizar acesso do tenant ao catálogo:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listar, promover, atualizar, deletar, enviarFoto, atualizarTenant };
