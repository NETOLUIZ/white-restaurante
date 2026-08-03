const STATUS_VALIDOS = ['LIVRE', 'OCUPADA', 'RESERVADA', 'CONTA'];
const FORMAS_PAGAMENTO_VALIDAS = ['PIX', 'CARTAO', 'DINHEIRO'];

/** Pedido em aberto de uma mesa = o mais recente ainda não pago/cancelado. */
function pedidoAbertoWhere(mesaId) {
  return { mesaId, statusEntrega: { notIn: ['ENTREGUE', 'CANCELADO'] } };
}

function mapMesa(mesa, pedido) {
  const itens = (pedido?.itens || []).map((item) => ({
    id: item.id,
    produtoId: item.produtoId,
    nome: item.produto ? item.produto.nome : '',
    quantidade: item.quantidade,
    precoUnitario: item.precoUnitarioCongelado,
  }));
  return {
    id: mesa.id,
    numero: mesa.numero,
    lugares: mesa.lugares,
    status: mesa.status,
    clienteNome: mesa.clienteNome,
    abertaEm: mesa.abertaEm,
    pedidoId: pedido ? pedido.id : null,
    itens,
    total: pedido ? pedido.total : 0,
  };
}

/** Lista todas as mesas com a comanda em aberto (se houver) já resolvida — painel admin. */
async function listarAdmin(req, res) {
  try {
    const mesas = await req.prisma.mesa.findMany({ orderBy: { numero: 'asc' } });
    const pedidosAbertos = await req.prisma.pedido.findMany({
      where: { tipo: 'MESA', mesaId: { in: mesas.map((m) => m.id) }, statusEntrega: { notIn: ['ENTREGUE', 'CANCELADO'] } },
      include: { itens: { include: { produto: true } } },
    });
    const pedidoPorMesa = new Map(pedidosAbertos.map((p) => [p.mesaId, p]));
    res.json(mesas.map((mesa) => mapMesa(mesa, pedidoPorMesa.get(mesa.id))));
  } catch (err) {
    console.error('Erro ao listar mesas:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Cria uma mesa nova — painel admin. */
async function criar(req, res) {
  try {
    const { numero, lugares } = req.body;
    if (!numero) {
      return res.status(400).json({ erro: 'Número da mesa é obrigatório' });
    }
    const mesa = await req.prisma.mesa.create({
      data: { numero: parseInt(numero, 10), lugares: lugares ? parseInt(lugares, 10) : 4 },
    });
    res.status(201).json(mapMesa(mesa, null));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe uma mesa com esse número' });
    }
    console.error('Erro ao criar mesa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza o nome do cliente sentado na mesa — painel admin. */
async function definirNome(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const clienteNome = (req.body.clienteNome || '').trim() || null;
    const mesa = await req.prisma.mesa.update({ where: { id }, data: { clienteNome } });

    // Mantém o nome do pedido em aberto em sincronia (aparece assim na lista de Pedidos).
    const pedido = await req.prisma.pedido.findFirst({ where: pedidoAbertoWhere(id) });
    if (pedido) {
      await req.prisma.pedido.update({ where: { id: pedido.id }, data: { nomeCliente: clienteNome || 'Mesa ' + mesa.numero } });
    }
    res.json(await mesaComPedido(req.prisma, id));
  } catch (err) {
    console.error('Erro ao definir nome da mesa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Muda o status da mesa (LIVRE | OCUPADA | RESERVADA | CONTA) — painel admin.
 * Ao liberar uma mesa que ainda tinha comanda em aberto (sem ter passado por
 * "fechar conta"), o pedido em aberto é cancelado — equivalente a um engano do garçom.
 */
async function mudarStatus(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }

    const data = { status };
    if (status === 'OCUPADA') data.abertaEm = new Date();
    if (status === 'LIVRE') {
      data.clienteNome = null;
      data.abertaEm = null;
      const pedidoAberto = await req.prisma.pedido.findFirst({ where: pedidoAbertoWhere(id) });
      if (pedidoAberto) {
        await req.prisma.pedido.update({ where: { id: pedidoAberto.id }, data: { statusEntrega: 'CANCELADO' } });
      }
    }

    await req.prisma.mesa.update({ where: { id }, data });
    // Busca o pedido em aberto de novo (não passa null) — senão o valor da conta
    // some da tela bem no momento de fechar a conta (status -> CONTA).
    res.json(await mesaComPedido(req.prisma, id));
  } catch (err) {
    console.error('Erro ao mudar status da mesa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Adiciona um produto à comanda da mesa (cria o pedido tipo MESA na primeira
 * vez). Preço sempre lido do catálogo no servidor — nunca aceito do client.
 */
async function adicionarItem(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const produtoId = parseInt(req.body.produtoId, 10);
    const delta = Math.max(1, parseInt(req.body.quantidade, 10) || 1);

    const mesa = await req.prisma.mesa.findFirst({ where: { id } });
    if (!mesa) return res.status(404).json({ erro: 'Mesa não encontrada' });
    if (mesa.status !== 'OCUPADA') {
      return res.status(409).json({ erro: 'Abra a mesa antes de adicionar itens' });
    }
    const produto = await req.prisma.produto.findFirst({ where: { id: produtoId, ativo: true } });
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado ou indisponível' });

    let pedido = await req.prisma.pedido.findFirst({ where: pedidoAbertoWhere(id), include: { itens: true } });
    if (!pedido) {
      // pedido.create de raiz sem itens aninhados — a extension já injeta o
      // tenantId aqui, sem precisar passar explícito (diferente do nested
      // create de pedidoController.js:189, que tem itens:{create:[...]} junto).
      pedido = await req.prisma.pedido.create({
        data: {
          tipo: 'MESA', mesaId: id,
          nomeCliente: mesa.clienteNome || 'Mesa ' + mesa.numero,
          subtotal: 0, total: 0,
        },
        include: { itens: true },
      });
    }

    const itemExistente = pedido.itens.find((it) => it.produtoId === produtoId);
    if (itemExistente) {
      await req.prisma.itemPedido.update({ where: { id: itemExistente.id }, data: { quantidade: itemExistente.quantidade + delta } });
    } else {
      // itemPedido.create direto (não aninhado em pedido.create) — é a
      // extension que injeta o tenantId, igual qualquer outro create de raiz.
      await req.prisma.itemPedido.create({
        data: { pedidoId: pedido.id, produtoId, quantidade: delta, precoUnitarioCongelado: produto.preco },
      });
    }

    await recalcularTotal(req.prisma, pedido.id);
    res.status(201).json(await mesaComPedido(req.prisma, id));
  } catch (err) {
    console.error('Erro ao adicionar item à comanda:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Ajusta a quantidade de um item da comanda (remove a linha se chegar a 0) — painel admin. */
async function ajustarItem(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const itemId = parseInt(req.params.itemId, 10);
    const quantidade = parseInt(req.body.quantidade, 10);

    const item = await req.prisma.itemPedido.findFirst({ where: { id: itemId }, include: { pedido: true } });
    if (!item || item.pedido.mesaId !== id) return res.status(404).json({ erro: 'Item não encontrado nessa mesa' });

    if (quantidade <= 0) {
      await req.prisma.itemPedido.delete({ where: { id: itemId } });
    } else {
      await req.prisma.itemPedido.update({ where: { id: itemId }, data: { quantidade } });
    }
    await recalcularTotal(req.prisma, item.pedidoId);
    res.json(await mesaComPedido(req.prisma, id));
  } catch (err) {
    console.error('Erro ao ajustar item da comanda:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Fecha a conta da mesa: define a forma de pagamento, conclui o pedido e libera a mesa — painel admin. */
async function fecharConta(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { formaPagamento } = req.body;
    if (!FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
      return res.status(400).json({ erro: 'Forma de pagamento inválida' });
    }

    const pedido = await req.prisma.pedido.findFirst({ where: pedidoAbertoWhere(id) });
    if (pedido) {
      await req.prisma.pedido.update({ where: { id: pedido.id }, data: { formaPagamento, statusEntrega: 'ENTREGUE' } });
    }
    const mesa = await req.prisma.mesa.update({ where: { id }, data: { status: 'LIVRE', clienteNome: null, abertaEm: null } });
    res.json(mapMesa(mesa, null));
  } catch (err) {
    console.error('Erro ao fechar conta da mesa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Helpers internos — recebem o client já escopado (req.prisma), não têm req próprio. */
async function recalcularTotal(prismaEscopado, pedidoId) {
  const itens = await prismaEscopado.itemPedido.findMany({ where: { pedidoId } });
  const subtotal = itens.reduce((soma, it) => soma + it.precoUnitarioCongelado * it.quantidade, 0);
  await prismaEscopado.pedido.update({ where: { id: pedidoId }, data: { subtotal, total: subtotal } });
}

async function mesaComPedido(prismaEscopado, mesaId) {
  const mesa = await prismaEscopado.mesa.findFirst({ where: { id: mesaId } });
  const pedido = await prismaEscopado.pedido.findFirst({ where: pedidoAbertoWhere(mesaId), include: { itens: { include: { produto: true } } } });
  return mapMesa(mesa, pedido);
}

module.exports = { listarAdmin, criar, definirNome, mudarStatus, adicionarItem, ajustarItem, fecharConta };
