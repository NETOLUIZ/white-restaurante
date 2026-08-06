/** Lista proteínas ativas (esgotadas continuam aparecendo, mas marcadas) — usado pela tela "Monte sua marmita". */
async function listarPublico(req, res) {
  try {
    let proteinas;
    try {
      proteinas = await req.prisma.proteina.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
    } catch (dbErr) {
      proteinas = await req.prisma.proteina.findMany({ select: { id: true, nome: true, ativo: true, esgotado: true }, where: { ativo: true }, orderBy: { nome: 'asc' } });
    }
    res.json(proteinas);
  } catch (err) {
    console.error('Erro ao listar proteínas:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Lista todas as proteínas (inclusive inativas) — painel admin. */
async function listarAdmin(req, res) {
  try {
    let proteinas;
    try {
      proteinas = await req.prisma.proteina.findMany({ orderBy: { nome: 'asc' } });
    } catch (dbErr) {
      proteinas = await req.prisma.proteina.findMany({ select: { id: true, nome: true, ativo: true, esgotado: true }, orderBy: { nome: 'asc' } });
    }
    res.json(proteinas);
  } catch (err) {
    console.error('Erro ao listar proteínas (admin):', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Cria uma proteína nova — painel admin. */
async function criar(req, res) {
  try {
    const { nome, tipo } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'Informe o nome da proteína' });
    }
    const proteina = await req.prisma.proteina.create({
      data: { nome: String(nome).trim(), tipo: tipo === 'executiva' ? 'executiva' : 'padrao' }
    });
    res.status(201).json(proteina);
  } catch (err) {
    console.error('Erro ao criar proteína:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza nome/ativo/esgotado/tipo de uma proteína — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { nome, ativo, esgotado, tipo } = req.body;
    const data = {};
    if (nome !== undefined) data.nome = String(nome).trim();
    if (ativo !== undefined) data.ativo = Boolean(ativo);
    if (esgotado !== undefined) data.esgotado = Boolean(esgotado);
    if (tipo !== undefined) data.tipo = tipo === 'executiva' ? 'executiva' : 'padrao';
    const proteina = await req.prisma.proteina.update({ where: { id }, data });
    res.json(proteina);
  } catch (err) {
    console.error('Erro ao atualizar proteína:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Remove uma proteína — painel admin. */
async function deletar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await req.prisma.proteina.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(409).json({ erro: 'Essa proteína já está em pedidos — desative em vez de remover' });
    }
    console.error('Erro ao remover proteína:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listarPublico, listarAdmin, criar, atualizar, deletar };
