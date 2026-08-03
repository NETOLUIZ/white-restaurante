/** Lista bairros ativos com sua taxa de entrega — usado pela tela de seleção de bairro do cliente. */
async function listarPublico(req, res) {
  try {
    const bairros = await req.prisma.bairro.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
    res.json(bairros);
  } catch (err) {
    console.error('Erro ao listar bairros:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Lista todos os bairros (inclusive inativos) — painel admin. */
async function listarAdmin(req, res) {
  try {
    const bairros = await req.prisma.bairro.findMany({ orderBy: { nome: 'asc' } });
    res.json(bairros);
  } catch (err) {
    console.error('Erro ao listar bairros (admin):', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Cria um bairro novo — painel admin. */
async function criar(req, res) {
  try {
    const { nome, taxaEntrega } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'Informe o nome do bairro' });
    }
    if (taxaEntrega === undefined || taxaEntrega === null || isNaN(Number(taxaEntrega)) || Number(taxaEntrega) < 0) {
      return res.status(400).json({ erro: 'Informe a taxa de entrega do bairro' });
    }
    const bairro = await req.prisma.bairro.create({
      data: { nome: String(nome).trim(), taxaEntrega: Number(taxaEntrega) },
    });
    res.status(201).json(bairro);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um bairro com esse nome' });
    }
    console.error('Erro ao criar bairro:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza nome/taxaEntrega/ativo de um bairro — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { nome, taxaEntrega, ativo } = req.body;
    const data = {};
    if (nome !== undefined) data.nome = String(nome).trim();
    if (taxaEntrega !== undefined) data.taxaEntrega = Number(taxaEntrega);
    if (ativo !== undefined) data.ativo = Boolean(ativo);
    const bairro = await req.prisma.bairro.update({ where: { id }, data });
    res.json(bairro);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um bairro com esse nome' });
    }
    console.error('Erro ao atualizar bairro:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Remove um bairro — painel admin. */
async function deletar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await req.prisma.bairro.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(409).json({ erro: 'Esse bairro já está em pedidos — desative em vez de remover' });
    }
    console.error('Erro ao remover bairro:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listarPublico, listarAdmin, criar, atualizar, deletar };
