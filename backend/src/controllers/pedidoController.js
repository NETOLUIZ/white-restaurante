const { prisma } = require('../utils/db');

// Pedido público (guest checkout, sem presença física) só aceita pagamento online —
// Dinheiro exigiria alguém fisicamente presente pra receber, por isso é exclusivo do atendente.
const FORMAS_PAGAMENTO_PUBLICO = ['PIX', 'CARTAO'];
const FORMAS_PAGAMENTO_ATENDENTE = ['PIX', 'CARTAO', 'DINHEIRO'];
const TAXA_ENTREGA_PADRAO = 7.9;

/**
 * Valida e monta um item de pedido a partir do corpo da requisição.
 * Cada item é OU um produto fixo do cardápio (produtoId) OU uma marmita
 * montada (tamanhoMarmitaId + proteinaIds + complementoIds) — nunca os dois.
 * O preço usado é sempre o do catálogo/tamanho no banco, nunca o que vier do client.
 */
async function montarItemValidado(item, produtosPorId, tamanhosPorId, proteinasPorId, complementosPorId) {
  const quantidade = Math.max(1, parseInt(item.quantidade, 10) || 1);
  const observacoes = item.observacoes ? String(item.observacoes).slice(0, 280) : null;

  if (item.tamanhoMarmitaId) {
    const tamanho = tamanhosPorId.get(String(item.tamanhoMarmitaId));
    if (!tamanho) {
      throw new Erro400(`Tamanho de marmita "${item.tamanhoMarmitaId}" não encontrado`);
    }
    const proteinaIds = Array.isArray(item.proteinaIds) ? item.proteinaIds.map((id) => parseInt(id, 10)) : [];
    const complementoIds = Array.isArray(item.complementoIds) ? item.complementoIds.map((id) => parseInt(id, 10)) : [];

    if (proteinaIds.length !== tamanho.qtdProteinas) {
      throw new Erro400(`${tamanho.nome} exige exatamente ${tamanho.qtdProteinas} proteína(s)`);
    }
    for (const id of proteinaIds) {
      const proteina = proteinasPorId.get(id);
      if (!proteina || !proteina.ativo || proteina.esgotado) {
        throw new Erro400(`Proteína ${id} indisponível`);
      }
    }
    for (const id of complementoIds) {
      const complemento = complementosPorId.get(id);
      if (!complemento || !complemento.ativo || complemento.esgotado) {
        throw new Erro400(`Complemento ${id} indisponível`);
      }
    }

    return {
      tamanhoMarmitaId: tamanho.id,
      produtoId: null,
      quantidade,
      observacoes,
      precoUnitarioCongelado: tamanho.preco,
      proteinas: { create: proteinaIds.map((proteinaId) => ({ proteinaId })) },
      complementos: { create: complementoIds.map((complementoId) => ({ complementoId })) },
      adicionais: { create: [] }, // marmita montada não tem adicionais — só produto fixo
    };
  }

  const produtoId = parseInt(item.produtoId, 10);
  const produto = produtosPorId.get(produtoId);
  if (!produto) {
    throw new Erro400(`Produto ${produtoId} não encontrado ou indisponível`);
  }

  const adicionaisPorId = new Map(produto.adicionais.map((a) => [a.id, a]));
  const adicionaisSelecionados = Array.isArray(item.adicionais) ? item.adicionais : [];
  const adicionaisValidados = adicionaisSelecionados.map((sel) => {
    const adicionalId = parseInt(sel.adicionalId, 10);
    const adicional = adicionaisPorId.get(adicionalId);
    if (!adicional || !adicional.ativo || adicional.esgotado) {
      throw new Erro400(`Adicional ${adicionalId} indisponível para o produto "${produto.nome}"`);
    }
    const quantidadeAdicional = Math.max(1, parseInt(sel.quantidade, 10) || 1);
    return { adicionalId, quantidade: quantidadeAdicional, precoUnitarioCongelado: adicional.preco };
  });

  return {
    produtoId: produto.id,
    tamanhoMarmitaId: null,
    quantidade,
    observacoes,
    precoUnitarioCongelado: produto.preco,
    adicionais: { create: adicionaisValidados },
  };
}

class Erro400 extends Error {}

/**
 * Cria um pedido (guest checkout — sem login). Recalcula preço, desconto e
 * total inteiramente no servidor a partir do catálogo e do cupom: nenhum
 * valor monetário enviado pelo client é confiado, mesmo que o corpo da
 * requisição inclua um total "pronto".
 *
 * Corpo esperado:
 *   { nomeCliente, telefone, endereco (obrigatorio se tipo=ENTREGA, omitido/null se RETIRADA), tipo?: 'ENTREGA'|'RETIRADA' (default ENTREGA),
 *     itens: [{ produtoId, quantidade, observacoes? } | { tamanhoMarmitaId, proteinaIds, complementoIds, quantidade, observacoes? }],
 *     cupomCodigo?, formaPagamento: 'PIX' | 'CARTAO' }
 */
async function criarPedidoInterno(req, res, formasPagamentoValidas, { exigirCliente = true } = {}) {
  try {
    const { nomeCliente, telefone, endereco, itens, cupomCodigo, formaPagamento } = req.body;
    const tipo = req.body.tipo === 'RETIRADA' ? 'RETIRADA' : 'ENTREGA';

    if ((exigirCliente && (!nomeCliente || !telefone)) || (tipo === 'ENTREGA' && !endereco) || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: 'Dados obrigatórios não informados' });
    }
    if (!formasPagamentoValidas.includes(formaPagamento)) {
      return res.status(400).json({ erro: 'Forma de pagamento inválida' });
    }
    // Endpoint público (sem login) — nunca confiar no formato/tamanho do que vier do client.
    // Pedido de balcão (atendente) não coleta cliente — usa nome genérico e sem telefone/cadastro de cliente.
    const nomeTrim = nomeCliente ? String(nomeCliente).trim() : 'Cliente balcão';
    if (exigirCliente && (nomeTrim.length < 2 || nomeTrim.length > 100)) {
      return res.status(400).json({ erro: 'Nome deve ter entre 2 e 100 caracteres' });
    }
    const telefoneDigitos = telefone ? String(telefone).replace(/\D/g, '') : '';
    if (exigirCliente && (telefoneDigitos.length < 10 || telefoneDigitos.length > 15)) {
      return res.status(400).json({ erro: 'Telefone inválido' });
    }
    if (tipo === 'ENTREGA' && (typeof endereco !== 'object' || Array.isArray(endereco) || endereco === null)) {
      return res.status(400).json({ erro: 'Endereço inválido' });
    }
    const LIMITES_ENDERECO = { rua: 150, numero: 20, complemento: 100, bairro: 100, cidade: 100, estado: 2 };
    for (const [campo, max] of Object.entries(tipo === 'ENTREGA' ? LIMITES_ENDERECO : {})) {
      if (endereco[campo] != null && String(endereco[campo]).length > max) {
        return res.status(400).json({ erro: `Campo de endereço "${campo}" excede o tamanho máximo` });
      }
    }
    if (itens.length > 50) {
      return res.status(400).json({ erro: 'Pedido excede o número máximo de itens' });
    }

    const produtoIds = itens.filter((i) => !i.tamanhoMarmitaId).map((i) => parseInt(i.produtoId, 10)).filter(Number.isInteger);
    const proteinaIds = itens.flatMap((i) => i.proteinaIds || []).map((id) => parseInt(id, 10));
    const complementoIds = itens.flatMap((i) => i.complementoIds || []).map((id) => parseInt(id, 10));

    const [produtos, tamanhos, proteinas, complementos] = await Promise.all([
      prisma.produto.findMany({ where: { id: { in: produtoIds }, ativo: true }, include: { adicionais: true } }),
      prisma.tamanhoMarmita.findMany(),
      prisma.proteina.findMany({ where: { id: { in: proteinaIds } } }),
      prisma.complemento.findMany({ where: { id: { in: complementoIds } } }),
    ]);
    const produtosPorId = new Map(produtos.map((p) => [p.id, p]));
    const tamanhosPorId = new Map(tamanhos.map((t) => [t.id, t]));
    const proteinasPorId = new Map(proteinas.map((p) => [p.id, p]));
    const complementosPorId = new Map(complementos.map((c) => [c.id, c]));

    let itensValidados;
    try {
      itensValidados = await Promise.all(
        itens.map((item) => montarItemValidado(item, produtosPorId, tamanhosPorId, proteinasPorId, complementosPorId)),
      );
    } catch (erro) {
      if (erro instanceof Erro400) {
        return res.status(400).json({ erro: erro.message });
      }
      throw erro;
    }

    const subtotal = itensValidados.reduce((soma, item) => {
      const totalAdicionais = item.adicionais.create.reduce((s, a) => s + a.precoUnitarioCongelado * a.quantidade, 0);
      return soma + item.precoUnitarioCongelado * item.quantidade + totalAdicionais;
    }, 0);

    // Cupom revalidado aqui mesmo que o client já tenha chamado /api/cupons/validar
    // antes do checkout — o desconto final nunca é aceito vindo do client.
    let cupom = null;
    if (cupomCodigo) {
      cupom = await prisma.cupom.findFirst({ where: { codigo: String(cupomCodigo).trim().toUpperCase(), ativo: true } });
      if (!cupom) {
        return res.status(400).json({ erro: 'Cupom inválido' });
      }
    }

    const desconto = cupom?.tipo === 'PERCENTUAL' ? subtotal * (cupom.percentual / 100) : 0;
    let taxaEntrega = 0;
    if (tipo === 'ENTREGA' && cupom?.tipo !== 'FRETE_GRATIS') {
      const config = await prisma.configuracao.findUnique({ where: { id: 1 } });
      taxaEntrega = config ? config.taxaEntrega : TAXA_ENTREGA_PADRAO;
    }
    const total = Math.max(0, Number((subtotal - desconto + taxaEntrega).toFixed(2)));

    // Pedido de balcão sem telefone não tem Cliente vinculado (não dá pra upsert sem a chave única).
    const cliente = telefoneDigitos
      ? await prisma.cliente.upsert({
          where: { telefone: telefoneDigitos },
          update: { nome: nomeTrim },
          create: { nome: nomeTrim, telefone: telefoneDigitos },
        })
      : null;

    const pedido = await prisma.pedido.create({
      data: {
        tipo,
        clienteId: cliente?.id ?? null,
        nomeCliente: nomeTrim,
        telefone: telefoneDigitos || null,
        endereco: tipo === 'ENTREGA' ? endereco : null,
        cupomId: cupom?.id ?? null,
        subtotal: Number(subtotal.toFixed(2)),
        desconto: Number(desconto.toFixed(2)),
        taxaEntrega,
        total,
        formaPagamento,
        itens: { create: itensValidados },
      },
      include: { itens: true },
    });

    // Log sem dado pessoal (LGPD) — só ids e valores, nunca telefone/endereço completos.
    console.log(`[pedido] criado id=${pedido.id} clienteId=${cliente?.id ?? null} total=${total}`);

    res.status(201).json({
      id: pedido.id,
      codigoAcompanhamento: pedido.codigoAcompanhamento,
      tipo: pedido.tipo,
      subtotal: pedido.subtotal,
      desconto: pedido.desconto,
      taxaEntrega: pedido.taxaEntrega,
      total: pedido.total,
      statusEntrega: pedido.statusEntrega,
    });
  } catch (err) {
    console.error('Erro ao criar pedido:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Guest checkout (sem login) — só pagamento online, ver FORMAS_PAGAMENTO_PUBLICO. */
function criar(req, res) {
  return criarPedidoInterno(req, res, FORMAS_PAGAMENTO_PUBLICO);
}

/** Pedido criado pelo atendente no balcão (autenticado) — aceita Dinheiro, pago na hora, sem coletar dados do cliente. */
function criarComoAtendente(req, res) {
  return criarPedidoInterno(req, res, FORMAS_PAGAMENTO_ATENDENTE, { exigirCliente: false });
}

/**
 * Detalhe de um pedido — usado pela tela de Acompanhar Pedido (polling, sem login).
 * Busca por codigoAcompanhamento (UUID), nunca pelo id sequencial — o id permitiria
 * qualquer pessoa enumerar /api/pedidos/1, /2, /3... e ver pedidos de outros clientes (IDOR).
 */
async function buscarPorCodigo(req, res) {
  try {
    const { codigo } = req.params;
    if (!codigo) {
      return res.status(400).json({ erro: 'Código de acompanhamento não informado' });
    }

    const pedido = await prisma.pedido.findFirst({
      where: { codigoAcompanhamento: codigo },
      include: {
        itens: {
          include: {
            produto: true,
            tamanhoMarmita: true,
            proteinas: { include: { proteina: true } },
            complementos: { include: { complemento: true } },
            adicionais: { include: { adicional: true } },
          },
        },
        entregador: true,
      },
    });
    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    res.json({
      id: pedido.id,
      statusEntrega: pedido.statusEntrega,
      subtotal: pedido.subtotal,
      desconto: pedido.desconto,
      taxaEntrega: pedido.taxaEntrega,
      total: pedido.total,
      formaPagamento: pedido.formaPagamento,
      criadoEm: pedido.createdAt,
      itens: pedido.itens.map((item) => ({
        produtoId: item.produtoId,
        nome: item.produto ? item.produto.nome : item.tamanhoMarmita?.nome,
        tamanhoMarmitaId: item.tamanhoMarmitaId,
        proteinas: item.proteinas.map((p) => p.proteina.nome),
        complementos: item.complementos.map((c) => c.complemento.nome),
        adicionais: item.adicionais.map((a) => ({ nome: a.adicional.nome, quantidade: a.quantidade, precoUnitario: a.precoUnitarioCongelado })),
        quantidade: item.quantidade,
        observacoes: item.observacoes,
        precoUnitario: item.precoUnitarioCongelado,
      })),
      entregador: pedido.entregador
        ? { nome: pedido.entregador.nome }
        : { nome: process.env.ENTREGADOR_NOME || 'Equipe de entrega' },
    });
  } catch (err) {
    console.error('Erro ao buscar pedido:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Lista os pedidos mais recentes, com nome dos itens já resolvido — painel admin. */
async function listarAdmin(req, res) {
  try {
    const pedidos = await prisma.pedido.findMany({
      include: {
        mesa: true,
        itens: {
          include: {
            produto: true,
            tamanhoMarmita: true,
            proteinas: { include: { proteina: true } },
            complementos: { include: { complemento: true } },
            adicionais: { include: { adicional: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(
      pedidos.map((pedido) => ({
        ...pedido,
        itens: pedido.itens.map((item) => ({
          produtoId: item.produtoId,
          nome: item.produto ? item.produto.nome : item.tamanhoMarmita?.nome,
          tamanhoMarmitaId: item.tamanhoMarmitaId,
          proteinas: item.proteinas.map((p) => p.proteina.nome),
          complementos: item.complementos.map((c) => c.complemento.nome),
          adicionais: item.adicionais.map((a) => ({ nome: a.adicional.nome, quantidade: a.quantidade, precoUnitario: a.precoUnitarioCongelado })),
          quantidade: item.quantidade,
          observacoes: item.observacoes,
          precoUnitario: item.precoUnitarioCongelado,
        })),
      })),
    );
  } catch (err) {
    console.error('Erro ao listar pedidos (admin):', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

const STATUS_VALIDOS = ['CONFIRMADO', 'PREPARANDO', 'SAIU_ENTREGA', 'ENTREGUE', 'CANCELADO'];

/** Avança/define o status de entrega de um pedido — painel admin. */
async function atualizarStatus(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { statusEntrega } = req.body;
    if (!STATUS_VALIDOS.includes(statusEntrega)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }
    const pedido = await prisma.pedido.update({ where: { id }, data: { statusEntrega } });
    res.json(pedido);
  } catch (err) {
    console.error('Erro ao atualizar status do pedido:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atribui (ou remove) um entregador de um pedido — painel admin. */
async function atribuirEntregador(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const entregadorId = req.body.entregadorId != null
      ? parseInt(req.body.entregadorId, 10)
      : null;
    const pedido = await prisma.pedido.update({
      where: { id },
      data: { entregadorId },
    });
    res.json(pedido);
  } catch (err) {
    console.error('Erro ao atribuir entregador:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Relatório do dia — retorna todos os pedidos desde meia-noite (horário local
 * do servidor) com KPIs: total de pedidos, faturamento, ticket médio e
 * contagem por status. Usado pelo painel admin.
 */
async function relatorioDia(req, res) {
  try {
    // Meia-noite de hoje no horário local do servidor
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const pedidos = await prisma.pedido.findMany({
      where: { createdAt: { gte: hoje } },
      include: {
        itens: {
          include: {
            produto: true,
            tamanhoMarmita: true,
            proteinas: { include: { proteina: true } },
            complementos: { include: { complemento: true } },
            adicionais: { include: { adicional: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPedidos = pedidos.length;
    const faturamento = Number(pedidos.reduce((soma, p) => soma + p.total, 0).toFixed(2));
    const ticketMedio = totalPedidos > 0 ? Number((faturamento / totalPedidos).toFixed(2)) : 0;

    // Contagem de pedidos por status
    const porStatus = {};
    for (const p of pedidos) {
      porStatus[p.statusEntrega] = (porStatus[p.statusEntrega] || 0) + 1;
    }

    res.json({
      pedidos: pedidos.map((pedido) => ({
        ...pedido,
        itens: pedido.itens.map((item) => ({
          produtoId: item.produtoId,
          nome: item.produto ? item.produto.nome : item.tamanhoMarmita?.nome,
          tamanhoMarmitaId: item.tamanhoMarmitaId,
          proteinas: item.proteinas.map((p) => p.proteina.nome),
          complementos: item.complementos.map((c) => c.complemento.nome),
          adicionais: item.adicionais.map((a) => ({ nome: a.adicional.nome, quantidade: a.quantidade, precoUnitario: a.precoUnitarioCongelado })),
          quantidade: item.quantidade,
          observacoes: item.observacoes,
          precoUnitario: item.precoUnitarioCongelado,
        })),
      })),
      totalPedidos,
      faturamento,
      ticketMedio,
      porStatus,
    });
  } catch (err) {
    console.error('Erro ao gerar relatório do dia:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { criar, criarComoAtendente, buscarPorCodigo, listarAdmin, atualizarStatus, atribuirEntregador, relatorioDia };
