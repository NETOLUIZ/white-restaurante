/**
 * Retorna o caixa atualmente aberto (fechadoEm = null), ou { aberto: false }
 * se não houver nenhum. Usado pelo painel admin para saber o estado do caixa
 * antes de renderizar o painel financeiro.
 */
async function status(req, res) {
  try {
    const caixa = await req.prisma.caixa.findFirst({
      where: { fechadoEm: null },
      orderBy: { abertoEm: 'desc' },
    });
    if (!caixa) {
      return res.json({ aberto: false });
    }
    res.json({ aberto: true, caixa });
  } catch (err) {
    console.error('Erro ao verificar status do caixa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Abre um novo caixa. Aceita `valorInicial` no body (default 0).
 * Retorna 409 se já houver um caixa aberto — regra: só um caixa aberto por vez.
 *
 * Corpo esperado: { valorInicial?: number }
 */
async function abrir(req, res) {
  try {
    // Garante que não há outro caixa aberto
    const jaAberto = await req.prisma.caixa.findFirst({ where: { fechadoEm: null } });
    if (jaAberto) {
      return res.status(409).json({ erro: 'Já existe um caixa aberto — feche-o antes de abrir um novo' });
    }

    const valorInicial = Number(req.body.valorInicial) || 0;
    const caixa = await req.prisma.caixa.create({ data: { valorInicial } });
    res.status(201).json(caixa);
  } catch (err) {
    console.error('Erro ao abrir caixa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Fecha o caixa aberto atual.
 * Calcula totalVendas somando o campo `total` dos Pedidos com
 * statusEntrega = ENTREGUE criados entre abertoEm e o momento do fechamento.
 * Retorna 409 se não houver caixa aberto.
 */
async function fechar(req, res) {
  try {
    const caixa = await req.prisma.caixa.findFirst({
      where: { fechadoEm: null },
      orderBy: { abertoEm: 'desc' },
    });
    if (!caixa) {
      return res.status(409).json({ erro: 'Não há caixa aberto para fechar' });
    }

    const fechadoEm = new Date();

    // Soma os totais dos pedidos ENTREGUE criados durante o período do caixa
    const pedidosEntregues = await req.prisma.pedido.findMany({
      where: {
        statusEntrega: 'ENTREGUE',
        createdAt: { gte: caixa.abertoEm, lte: fechadoEm },
      },
      select: { total: true },
    });

    const totalVendas = pedidosEntregues.reduce((soma, p) => soma + p.total, 0);

    const caixaFechado = await req.prisma.caixa.update({
      where: { id: caixa.id },
      data: {
        fechadoEm,
        totalVendas: Number(totalVendas.toFixed(2)),
      },
    });

    res.json(caixaFechado);
  } catch (err) {
    console.error('Erro ao fechar caixa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { status, abrir, fechar };
