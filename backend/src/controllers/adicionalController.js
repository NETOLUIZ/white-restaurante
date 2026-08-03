/** Cria um adicional novo, sempre vinculado a um produto — painel admin. */
async function criar(req, res) {
  try {
    const produtoId = parseInt(req.params.produtoId, 10);
    const { nome, preco } = req.body;
    if (!nome || !String(nome).trim() || preco === undefined) {
      return res.status(400).json({ erro: 'Informe o nome e o preço do adicional' });
    }
    const produto = await req.prisma.produto.findFirst({ where: { id: produtoId } });
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    const adicional = await req.prisma.adicional.create({
      data: { produtoId, nome: String(nome).trim(), preco: Number(preco) },
    });
    res.status(201).json(adicional);
  } catch (err) {
    console.error('Erro ao criar adicional:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza nome/preço/ativo/esgotado de um adicional — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { nome, preco, ativo, esgotado } = req.body;
    const data = {};
    if (nome !== undefined) data.nome = String(nome).trim();
    if (preco !== undefined) data.preco = Number(preco);
    if (ativo !== undefined) data.ativo = Boolean(ativo);
    if (esgotado !== undefined) data.esgotado = Boolean(esgotado);
    const adicional = await req.prisma.adicional.update({ where: { id }, data });
    res.json(adicional);
  } catch (err) {
    console.error('Erro ao atualizar adicional:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Remove um adicional — painel admin. */
async function deletar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await req.prisma.adicional.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(409).json({ erro: 'Esse adicional já está em pedidos — desative em vez de remover' });
    }
    console.error('Erro ao remover adicional:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { criar, atualizar, deletar };
