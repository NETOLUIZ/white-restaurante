/**
 * Valida um cupom pelo código (case-insensitive). O desconto nunca é
 * calculado no client — esta rota só confirma se o cupom existe e está
 * ativo. O valor final é sempre recalculado de novo na criação do pedido
 * (ver pedidoController.criar).
 */
async function validar(req, res) {
  try {
    const { codigo } = req.body;
    if (!codigo || typeof codigo !== 'string') {
      return res.status(400).json({ erro: 'Código do cupom não informado' });
    }

    const cupom = await req.prisma.cupom.findFirst({
      where: { codigo: codigo.trim().toUpperCase(), ativo: true },
    });

    if (!cupom) {
      return res.json({ valido: false, mensagem: 'Cupom inválido. Tente FRANGO10.' });
    }

    const mensagem =
      cupom.tipo === 'FRETE_GRATIS'
        ? 'Frete grátis aplicado!'
        : `Cupom aplicado: ${cupom.percentual}% de desconto!`;

    res.json({ valido: true, mensagem, tipo: cupom.tipo, percentual: cupom.percentual ?? null });
  } catch (err) {
    console.error('Erro ao validar cupom:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Lista todos os cupons — painel admin. */
async function listarAdmin(req, res) {
  try {
    const cupons = await req.prisma.cupom.findMany({ orderBy: { codigo: 'asc' } });
    res.json(cupons);
  } catch (err) {
    console.error('Erro ao listar cupons:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Cria um cupom novo — painel admin. */
async function criar(req, res) {
  try {
    const { codigo, tipo, percentual, ativo } = req.body;
    if (!codigo || !tipo) {
      return res.status(400).json({ erro: 'Código e tipo são obrigatórios' });
    }
    if (tipo === 'PERCENTUAL' && !percentual) {
      return res.status(400).json({ erro: 'Cupom percentual precisa do campo percentual' });
    }
    const cupom = await req.prisma.cupom.create({
      data: {
        codigo: String(codigo).trim().toUpperCase(),
        tipo,
        percentual: tipo === 'PERCENTUAL' ? Number(percentual) : null,
        ativo: ativo === undefined ? true : Boolean(ativo),
      },
    });
    res.status(201).json(cupom);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um cupom com esse código' });
    }
    console.error('Erro ao criar cupom:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Ativa/desativa ou atualiza um cupom — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { tipo, percentual, ativo } = req.body;
    const data = {};
    if (tipo !== undefined) data.tipo = tipo;
    if (percentual !== undefined) data.percentual = percentual === null ? null : Number(percentual);
    if (ativo !== undefined) data.ativo = Boolean(ativo);

    const cupom = await req.prisma.cupom.update({ where: { id }, data });
    res.json(cupom);
  } catch (err) {
    console.error('Erro ao atualizar cupom:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { validar, listarAdmin, criar, atualizar };
