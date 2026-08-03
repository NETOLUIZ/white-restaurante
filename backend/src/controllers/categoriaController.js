const path = require('path');
const fs = require('fs');

/** Lista as categorias, ordenadas por `ordem` — usado pela Home e pelo Cardápio. */
async function listarPublico(req, res) {
  try {
    const categorias = await req.prisma.categoriaProduto.findMany({
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
    res.json(categorias);
  } catch (err) {
    console.error('Erro ao listar categorias:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Cria uma categoria nova — painel admin. */
async function criar(req, res) {
  try {
    const { nome, ordem } = req.body;
    if (!nome) {
      return res.status(400).json({ erro: 'Nome da categoria é obrigatório' });
    }
    const categoria = await req.prisma.categoriaProduto.create({
      data: { nome: String(nome).trim(), ordem: Number(ordem) || 0 },
    });
    res.status(201).json(categoria);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe uma categoria com esse nome' });
    }
    console.error('Erro ao criar categoria:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza nome/ordem de uma categoria — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { nome, ordem } = req.body;
    const data = {};
    if (nome !== undefined) data.nome = String(nome).trim();
    if (ordem !== undefined) data.ordem = Number(ordem);

    const categoria = await req.prisma.categoriaProduto.update({ where: { id }, data });
    res.json(categoria);
  } catch (err) {
    console.error('Erro ao atualizar categoria:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Remove uma categoria — painel admin. Falha se ainda houver produtos nela (FK). */
async function deletar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await req.prisma.categoriaProduto.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(409).json({ erro: 'Existem produtos nessa categoria — mova ou remova eles primeiro' });
    }
    console.error('Erro ao remover categoria:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Recebe a foto da categoria via multipart/form-data (campo "foto", ver multer
 * em routes/admin.js) e salva só o caminho relativo no banco — o arquivo em
 * si fica em /uploads/{tenantId}/categorias, nunca como base64 no banco.
 */
async function enviarFoto(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo de imagem enviado' });
    }
    // Prefixo com tenantId — ver mesmo comentário em produtoController.enviarFoto.
    const caminhoRelativo = `${req.tenantId}/categorias/${req.file.filename}`;
    const categoria = await req.prisma.categoriaProduto.update({ where: { id }, data: { foto: caminhoRelativo } });
    res.json({ foto: `/uploads/${caminhoRelativo}`, categoria });
  } catch (err) {
    console.error('Erro ao salvar foto da categoria:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Remove a foto da categoria: apaga o arquivo em disco e limpa o campo `foto` no banco. */
async function removerFoto(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const categoria = await req.prisma.categoriaProduto.findFirst({ where: { id }, select: { foto: true } });
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada' });

    if (categoria.foto) {
      const caminhoArquivo = path.join(__dirname, '..', '..', 'uploads', categoria.foto);
      fs.unlink(caminhoArquivo, (unlinkErr) => {
        if (unlinkErr) console.warn('Aviso: não foi possível deletar arquivo da categoria:', unlinkErr.message);
      });
    }

    const categoriaAtualizada = await req.prisma.categoriaProduto.update({ where: { id }, data: { foto: null } });
    res.json({ categoria: categoriaAtualizada });
  } catch (err) {
    console.error('Erro ao remover foto da categoria:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listarPublico, criar, atualizar, deletar, enviarFoto, removerFoto };
