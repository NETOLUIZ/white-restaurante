/** Lista complementos ativos — usado pela tela "Monte sua marmita". */
async function listarPublico(req, res) {
  try {
    const complementos = await req.prisma.complemento.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
    res.json(complementos);
  } catch (err) {
    console.error('Erro ao listar complementos:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Lista todos os complementos (inclusive inativos) — painel admin. */
async function listarAdmin(req, res) {
  try {
    const complementos = await req.prisma.complemento.findMany({ orderBy: { nome: 'asc' } });
    res.json(complementos);
  } catch (err) {
    console.error('Erro ao listar complementos (admin):', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Cria um complemento novo — painel admin. */
async function criar(req, res) {
  try {
    const { nome } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'Informe o nome do complemento' });
    }
    const complemento = await req.prisma.complemento.create({ data: { nome: String(nome).trim() } });
    res.status(201).json(complemento);
  } catch (err) {
    console.error('Erro ao criar complemento:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza nome/ativo/esgotado de um complemento — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { nome, ativo, esgotado } = req.body;
    const data = {};
    if (nome !== undefined) data.nome = String(nome).trim();
    if (ativo !== undefined) data.ativo = Boolean(ativo);
    if (esgotado !== undefined) data.esgotado = Boolean(esgotado);
    const complemento = await req.prisma.complemento.update({ where: { id }, data });
    res.json(complemento);
  } catch (err) {
    console.error('Erro ao atualizar complemento:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Remove um complemento — painel admin. */
async function deletar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await req.prisma.complemento.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(409).json({ erro: 'Esse complemento já está em pedidos — desative em vez de remover' });
    }
    console.error('Erro ao remover complemento:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listarPublico, listarAdmin, criar, atualizar, deletar };
