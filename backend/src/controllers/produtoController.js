const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const sharp = require('sharp');
const ExcelJS = require('exceljs');
const { parsePlanilha, gerarPlanilhaModelo } = require('../utils/produtoImport');
const { buscarPorCodigoBarras, baixarImagem } = require('../utils/openFoodFacts');

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

    const produtos = await req.prisma.produto.findMany({
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
    const produto = await req.prisma.produto.findFirst({
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
    const produtos = await req.prisma.produto.findMany({
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
    const { categoriaId, subcategoriaId, nome, descricaoCurta, descricaoCompleta, preco, custo, codigoBarras, avaliacao, tag, destaque, ativo, estoque, vendidoPorPeso } = req.body;
    let catId = categoriaId ? parseInt(categoriaId, 10) : null;
    if (catId) {
      // findFirst é escopado por tenant via req.prisma (ver prismaTenant.js) —
      // se o id vier de outro tenant, a busca não acha nada. Sem essa checagem,
      // um categoriaId de outro tenant salvava normalmente (mesma classe do
      // achado de bairroId no checkout, ver AUDITORIA.md) e o produto ficava
      // "órfão" pro isolamento: nunca aparecia em /api/categorias do próprio
      // tenant, então a Home não tinha como agrupar/exibi-lo.
      const categoria = await req.prisma.categoriaProduto.findFirst({ where: { id: catId } });
      if (!categoria) {
        return res.status(400).json({ erro: 'Categoria inválida' });
      }
    } else {
      // Mesmo raciocínio pro fallback "sem categoria escolhida": antes caía
      // num id global fixo (1), que podia pertencer a outro tenant. Sem
      // nenhuma categoria própria, é melhor recusar do que adivinhar.
      const primCat = await req.prisma.categoriaProduto.findFirst({ orderBy: { id: 'asc' } });
      if (!primCat) {
        return res.status(400).json({ erro: 'Crie uma categoria antes de adicionar produtos' });
      }
      catId = primCat.id;
    }
    const produto = await req.prisma.produto.create({
      data: {
        categoriaId: catId,
        subcategoriaId: subcategoriaId ? parseInt(subcategoriaId, 10) : null,
        nome: nome ? String(nome).trim() : 'Novo Produto',
        descricaoCurta: descricaoCurta ? String(descricaoCurta).trim() : '',
        descricaoCompleta: descricaoCompleta ? String(descricaoCompleta).trim() : (descricaoCurta ? String(descricaoCurta).trim() : ''),
        preco: preco !== undefined && preco !== null && !isNaN(Number(preco)) ? Number(preco) : 0,
        custo: custo != null && custo !== '' ? Number(custo) : null,
        // string vazia vira null — senão dois produtos sem código de barras
        // colidiriam no índice único (tenantId, codigoBarras), que só trata
        // NULL como "sem valor" de verdade (Postgres permite múltiplos NULL).
        codigoBarras: codigoBarras ? String(codigoBarras).trim() : null,
        avaliacao: avaliacao != null ? Number(avaliacao) : null,
        tag: tag || null,
        destaque: Boolean(destaque),
        estoque: estoque !== undefined ? parseInt(estoque, 10) || 0 : 0,
        ativo: ativo === undefined ? true : Boolean(ativo),
        vendidoPorPeso: Boolean(vendidoPorPeso),
      },
      include: { adicionais: true },
    });
    res.status(201).json(produto);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um produto com esse código de barras' });
    }
    console.error('Erro ao criar produto:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza um produto — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { categoriaId, subcategoriaId, nome, descricaoCurta, descricaoCompleta, preco, custo, codigoBarras, avaliacao, tag, destaque, ativo, estoque, disponivelEmpresa, vendidoPorPeso } = req.body;
    const data = {};
    if (categoriaId !== undefined) {
      const novoCatId = parseInt(categoriaId, 10);
      const categoria = await req.prisma.categoriaProduto.findFirst({ where: { id: novoCatId } });
      if (!categoria) {
        return res.status(400).json({ erro: 'Categoria inválida' });
      }
      data.categoriaId = novoCatId;
    }
    if (subcategoriaId !== undefined) data.subcategoriaId = subcategoriaId ? parseInt(subcategoriaId, 10) : null;
    if (nome !== undefined) data.nome = String(nome).trim();
    if (descricaoCurta !== undefined) data.descricaoCurta = String(descricaoCurta).trim();
    if (descricaoCompleta !== undefined) data.descricaoCompleta = String(descricaoCompleta).trim();
    if (preco !== undefined) data.preco = Number(preco);
    if (custo !== undefined) data.custo = custo === null || custo === '' ? null : Number(custo);
    if (codigoBarras !== undefined) data.codigoBarras = codigoBarras ? String(codigoBarras).trim() : null;
    if (avaliacao !== undefined) data.avaliacao = avaliacao === null ? null : Number(avaliacao);
    if (tag !== undefined) data.tag = tag || null;
    if (destaque !== undefined) data.destaque = Boolean(destaque);
    if (estoque !== undefined) data.estoque = Math.max(0, parseInt(estoque, 10) || 0);
    if (ativo !== undefined) data.ativo = Boolean(ativo);
    if (disponivelEmpresa !== undefined) data.disponivelEmpresa = Boolean(disponivelEmpresa);
    if (vendidoPorPeso !== undefined) data.vendidoPorPeso = Boolean(vendidoPorPeso);

    const produto = await req.prisma.produto.update({ where: { id }, data, include: { adicionais: true } });
    res.json(produto);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um produto com esse código de barras' });
    }
    console.error('Erro ao atualizar produto:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Soma `delta` (pode ser negativo) ao estoque do produto, sem deixar passar de 0 — painel admin. */
async function ajustarEstoque(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const delta = parseInt(req.body.delta, 10) || 0;
    const atual = await req.prisma.produto.findFirst({ where: { id } });
    if (!atual) return res.status(404).json({ erro: 'Produto não encontrado' });
    const produto = await req.prisma.produto.update({ where: { id }, data: { estoque: Math.max(0, atual.estoque + delta) }, include: { adicionais: true } });
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
    await req.prisma.produto.delete({ where: { id } });
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
 * si fica em /uploads/{tenantId}/produtos, nunca como base64 numa coluna.
 */
async function enviarFoto(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo de imagem enviado' });
    }
    // Prefixo com tenantId — o front monta a URL como "/uploads/" + foto direto
    // (não pode ser alterado), e o arquivo físico agora vive em
    // uploads/{tenantId}/produtos/ (Fase 5), não mais numa pasta compartilhada.
    const caminhoRelativo = `${req.tenantId}/produtos/${req.file.filename}`;
    const produto = await req.prisma.produto.update({ where: { id }, data: { foto: caminhoRelativo }, include: { adicionais: true } });
    res.json({ foto: `/uploads/${caminhoRelativo}`, produto });
  } catch (err) {
    console.error('Erro ao salvar foto do produto:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Consulta a Open Food Facts por código de barras — autofill do cadastro de
 * produto no Admin (o campo de código só existe pra tenant MERCANTIL, mas a
 * rota não restringe: é uma consulta pública, sem dado sensível).
 */
async function buscarCodigoBarras(req, res) {
  const codigo = String(req.params.codigo || '').replace(/\D/g, '');
  if (codigo.length < 8 || codigo.length > 14) {
    return res.status(400).json({ erro: 'Código de barras inválido — use de 8 a 14 dígitos' });
  }
  try {
    const produto = await buscarPorCodigoBarras(codigo);
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado na base Open Food Facts' });
    }
    res.json(produto);
  } catch (err) {
    console.error('Erro ao consultar Open Food Facts:', err);
    res.status(502).json({ erro: 'Não foi possível consultar a base de produtos agora — tente de novo' });
  }
}

/**
 * Importa a foto do produto a partir de uma URL da Open Food Facts (só desse
 * host — ver utils/openFoodFacts.js) — converte pra WebP e salva no mesmo
 * diretório/formato do upload manual (uploads/{tenantId}/produtos/*.webp),
 * então o resto do sistema não distingue a origem da foto.
 */
async function importarFotoUrl(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const buffer = await baixarImagem(String(req.body.url || ''));

    const dir = path.join(__dirname, '..', '..', 'uploads', req.tenantId, 'produtos');
    await fs.mkdir(dir, { recursive: true });
    const filename = `${crypto.randomBytes(16).toString('hex')}.webp`;
    await sharp(buffer).webp({ quality: 80 }).toFile(path.join(dir, filename));

    const caminhoRelativo = `${req.tenantId}/produtos/${filename}`;
    const produto = await req.prisma.produto.update({ where: { id }, data: { foto: caminhoRelativo }, include: { adicionais: true } });
    res.json({ foto: `/uploads/${caminhoRelativo}`, produto });
  } catch (err) {
    if (err.codigo === 'URL_INVALIDA') {
      return res.status(400).json({ erro: err.message });
    }
    console.error('Erro ao importar foto por URL:', err);
    res.status(502).json({ erro: 'Não foi possível baixar a foto do produto' });
  }
}

/** Remove a foto do produto (volta a usar o placeholder no front) — painel admin. */
async function removerFoto(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const produto = await req.prisma.produto.update({ where: { id }, data: { foto: null }, include: { adicionais: true } });
    res.json({ produto });
  } catch (err) {
    console.error('Erro ao remover foto do produto:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

function normalizarNome(nome) {
  return nome.trim().toLowerCase();
}

/** Gera e devolve o .xlsx modelo pra importação em lote — painel admin. */
async function baixarModeloImportacao(req, res) {
  try {
    const buffer = await gerarPlanilhaModelo();
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="modelo-produtos.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Erro ao gerar modelo de importação:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Importa produtos em lote a partir de uma planilha .xlsx — painel admin.
 * Tudo-ou-nada: se qualquer linha tiver erro (formato ou duplicata), nada é
 * gravado — devolve a lista de erros pra corrigir na planilha e reenviar.
 */
async function importarProdutos(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado (campo esperado: "arquivo")' });
    }
    // .xlsx é um ZIP — os dois primeiros bytes são sempre "PK". Checar extensão
    // sozinha deixa passar qualquer arquivo só porque renomearam pra .xlsx.
    const pareceXlsx = req.file.buffer.length > 2 && req.file.buffer[0] === 0x50 && req.file.buffer[1] === 0x4b;
    if (!pareceXlsx) {
      return res.status(400).json({ erro: 'Formato inválido — envie um arquivo .xlsx (baixe a planilha modelo se não tiver uma).' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    let linhas;
    let erros;
    try {
      ({ linhas, erros } = parsePlanilha(workbook));
    } catch (err) {
      return res.status(err.status || 400).json({ erro: err.message });
    }

    const [produtosExistentes, categoriasExistentes] = await Promise.all([
      req.prisma.produto.findMany({ select: { nome: true } }),
      req.prisma.categoriaProduto.findMany(),
    ]);
    const nomesExistentes = new Set(produtosExistentes.map((p) => normalizarNome(p.nome)));
    const categoriaIdPorNome = new Map(categoriasExistentes.map((c) => [normalizarNome(c.nome), c.id]));

    // Duplicata é quase sempre a mesma planilha importada duas vezes por engano
    // — rejeitar a linha inteira é mais seguro que criar um produto repetido.
    const nomesVistosNoArquivo = new Set();
    const todosOsErros = [...erros];
    for (const linha of linhas) {
      const chave = normalizarNome(linha.nome);
      if (nomesExistentes.has(chave)) {
        todosOsErros.push({ linha: linha.linha, erro: `Já existe um produto chamado "${linha.nome}".` });
      } else if (nomesVistosNoArquivo.has(chave)) {
        todosOsErros.push({ linha: linha.linha, erro: `Nome "${linha.nome}" repetido na planilha.` });
      }
      nomesVistosNoArquivo.add(chave);
    }

    if (todosOsErros.length > 0) {
      todosOsErros.sort((a, b) => a.linha - b.linha);
      return res.status(201).json({ importados: 0, categoriasCriadas: 0, erros: todosOsErros });
    }

    const categoriasParaCriar = new Set();
    for (const linha of linhas) {
      if (!categoriaIdPorNome.has(normalizarNome(linha.categoriaNome))) categoriasParaCriar.add(linha.categoriaNome);
    }

    const resultado = await req.prisma.$transaction(async (tx) => {
      let categoriasCriadas = 0;
      for (const nomeCategoria of categoriasParaCriar) {
        const chave = normalizarNome(nomeCategoria);
        if (categoriaIdPorNome.has(chave)) continue; // já resolvida por uma linha anterior deste mesmo lote
        const nova = await tx.categoriaProduto.create({ data: { nome: nomeCategoria } });
        categoriaIdPorNome.set(chave, nova.id);
        categoriasCriadas++;
      }

      for (const linha of linhas) {
        await tx.produto.create({
          data: {
            categoriaId: categoriaIdPorNome.get(normalizarNome(linha.categoriaNome)),
            nome: linha.nome,
            descricaoCurta: linha.descricaoCurta,
            descricaoCompleta: linha.descricaoCurta,
            preco: linha.preco,
            estoque: linha.estoque,
            vendidoPorPeso: linha.vendidoPorPeso,
          },
        });
      }

      return { importados: linhas.length, categoriasCriadas };
    });

    res.status(201).json({ ...resultado, erros: [] });
  } catch (err) {
    console.error('Erro ao importar produtos:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = {
  listarPublico, buscarPorId, listarAdmin, criar, atualizar, deletar, enviarFoto, removerFoto, ajustarEstoque,
  baixarModeloImportacao, importarProdutos, buscarCodigoBarras, importarFotoUrl,
};
