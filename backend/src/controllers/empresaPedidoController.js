const { montarItemValidado, Erro400 } = require('./pedidoController');

/**
 * Cardápio restrito do canal empresa — produtos fixos marcados como "prato do
 * dia" + (se habilitado) o "Monte sua marmita" com os mesmos tamanhos/proteínas/
 * complementos do cardápio normal, restritos aos tamanhos marcados pro canal empresa.
 */
async function cardapio(req, res) {
  try {
    const [produtos, tamanhos, proteinas, complementos] = await Promise.all([
      req.prisma.produto.findMany({ where: { ativo: true, disponivelEmpresa: true }, orderBy: { nome: 'asc' } }),
      req.prisma.tamanhoMarmita.findMany({ where: { disponivelEmpresa: true }, orderBy: { qtdProteinas: 'asc' } }),
      req.prisma.proteina.findMany({ where: { ativo: true, esgotado: false }, orderBy: { nome: 'asc' } }),
      req.prisma.complemento.findMany({ where: { ativo: true, esgotado: false }, orderBy: { nome: 'asc' } }),
    ]);
    res.json({ produtos, tamanhos, proteinas, complementos });
  } catch (err) {
    console.error('Erro ao listar cardápio da empresa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Pedidos de hoje da empresa logada + cota diária, pra tela mostrar quanto ainda pode pedir. */
async function meusPedidosHoje(req, res) {
  try {
    const empresa = await req.prisma.empresa.findFirst({ where: { id: req.empresa.id } });
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const pedidos = await req.prisma.pedido.findMany({
      where: { empresaId: empresa.id, tipo: 'EMPRESA', createdAt: { gte: hoje } },
      include: { itens: { include: { produto: true, tamanhoMarmita: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      cotaDiaria: empresa.cotaDiaria,
      usadoHoje: pedidos.length,
      restante: Math.max(0, empresa.cotaDiaria - pedidos.length),
      pedidos: pedidos.map((p) => ({
        id: p.id,
        nomeCliente: p.nomeCliente,
        statusEntrega: p.statusEntrega,
        createdAt: p.createdAt,
        itens: p.itens.map((item) => ({ nome: item.produto?.nome || item.tamanhoMarmita?.nome, quantidade: item.quantidade })),
      })),
    });
  } catch (err) {
    console.error('Erro ao listar pedidos da empresa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Núcleo da criação de um pedido de empresa — usado tanto pelo self-service
 * (empresaPedidoController.criarLote) quanto pelo admin lançando em nome da
 * empresa (empresaAdminController). O pedido é composto por um ou mais
 * "lotes": cada lote é UM combo de itens (produto fixo ou monte-sua-marmita)
 * repetido `quantidade` vezes, com endereço e nomes (opcionais) próprios —
 * pensado pra empresa com entrega em mais de um endereço no mesmo dia (ex:
 * construtora com obras em bairros diferentes).
 *
 * Cada unidade de cada lote vira um Pedido próprio (tipo EMPRESA) — não existe
 * "carrinho único", cada pessoa tem seu pedido rastreável no painel do admin.
 * Nome não informado (quantidade > nomes.length) cai num nome genérico
 * "Pedido N", já que nomeCliente é obrigatório no schema.
 *
 * Preço: se a empresa tem `valorMarmita` > 0, esse valor fixo sobrepõe o
 * preço calculado do catálogo pra cada unidade — caso contrário (0, padrão)
 * mantém o preço normal por produto/tamanho.
 *
 * Autossalva o nome de cada funcionário informado (EmpresaFuncionario), pra
 * aparecer como sugestão nos próximos pedidos sem precisar digitar de novo.
 */
async function criarLoteParaEmpresa(tx, tenantId, empresaId, { lotes }) {
  if (!Array.isArray(lotes) || lotes.length === 0) {
    throw new Erro400('Informe ao menos um lote no pedido');
  }
  if (lotes.length > 20) {
    throw new Erro400('Excede o número máximo de lotes por envio');
  }

  const lotesNormalizados = lotes.map((lote) => {
    const quantidade = Math.max(1, parseInt(lote.quantidade, 10) || 1);
    const endereco = typeof lote.endereco === 'string' ? lote.endereco.trim().slice(0, 200) : '';
    const nomes = Array.isArray(lote.nomes) ? lote.nomes.map((n) => String(n).trim()).filter(Boolean).slice(0, quantidade) : [];
    return { ...lote, quantidade, endereco, nomes };
  });

  const totalUnidades = lotesNormalizados.reduce((s, l) => s + l.quantidade, 0);
  if (totalUnidades > 200) {
    throw new Erro400('Lote excede o número máximo de pedidos por envio');
  }

  const empresa = await tx.empresa.findFirst({ where: { id: empresaId } });
  if (!empresa || !empresa.ativo) {
    throw new Erro400('Empresa inválida ou inativa');
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const usadoHoje = await tx.pedido.count({ where: { empresaId: empresa.id, tipo: 'EMPRESA', createdAt: { gte: hoje } } });
  const restante = empresa.cotaDiaria - usadoHoje;
  if (totalUnidades > restante) {
    throw new Erro400(
      restante <= 0
        ? 'A cota diária de pedidos desta empresa já foi atingida'
        : `Esse pedido excede a cota diária — restam ${restante} pedido(s) hoje`,
    );
  }

  // Só produtos/tamanhos marcados pro canal empresa entram nos mapas — um lote
  // fora dessa lista (mesmo que válido no cardápio normal) é rejeitado abaixo.
  const produtoIds = lotesNormalizados.filter((l) => !l.tamanhoMarmitaId).map((l) => parseInt(l.produtoId, 10)).filter(Number.isInteger);
  const proteinaIds = lotesNormalizados.flatMap((l) => l.proteinaIds || []).map((id) => parseInt(id, 10));
  const complementoIds = lotesNormalizados.flatMap((l) => l.complementoIds || []).map((id) => parseInt(id, 10));

  const [produtos, tamanhos, proteinas, complementos] = await Promise.all([
    tx.produto.findMany({ where: { id: { in: produtoIds }, ativo: true, disponivelEmpresa: true }, include: { adicionais: true } }),
    tx.tamanhoMarmita.findMany({ where: { disponivelEmpresa: true } }),
    tx.proteina.findMany({ where: { id: { in: proteinaIds } } }),
    tx.complemento.findMany({ where: { id: { in: complementoIds } } }),
  ]);
  const produtosPorId = new Map(produtos.map((p) => [p.id, p]));
  // Indexado por slug ('pequena'/'grande'), não pelo id numérico — ver
  // pedidoController.montarItemValidado.
  const tamanhosPorSlug = new Map(tamanhos.map((t) => [t.slug, t]));
  const proteinasPorId = new Map(proteinas.map((p) => [p.id, p]));
  const complementosPorId = new Map(complementos.map((c) => [c.id, c]));

  // Um item validado por LOTE (o combo) — quantidade:1 porque cada unidade
  // vira um Pedido separado, não um único ItemPedido com quantidade N.
  const itensValidados = await Promise.all(
    lotesNormalizados.map((lote) => montarItemValidado({ ...lote, quantidade: 1 }, produtosPorId, tamanhosPorSlug, proteinasPorId, complementosPorId)),
  );

  const criados = [];
  for (let l = 0; l < lotesNormalizados.length; l++) {
    const lote = lotesNormalizados[l];
    const item = itensValidados[l];
    const precoUnitario = empresa.valorMarmita > 0 ? empresa.valorMarmita : item.precoUnitarioCongelado;
    const totalAdicionais = item.adicionais.create.reduce((s, a) => s + a.precoUnitarioCongelado * a.quantidade, 0);
    const subtotal = Number((precoUnitario + totalAdicionais).toFixed(2));

    for (let i = 0; i < lote.quantidade; i++) {
      const nome = lote.nomes[i] || `Pedido ${criados.length + 1}`;
      // Nested create: o model raiz (Pedido) é escopado pela extension, mas
      // o ItemPedido aninhado em itens:{create:[...]} não — precisa do
      // tenantId explícito aqui (mesma armadilha de pedidoController.js).
      const pedido = await tx.pedido.create({
        data: {
          tipo: 'EMPRESA',
          empresaId: empresa.id,
          nomeCliente: nome,
          endereco: lote.endereco ? { texto: lote.endereco } : undefined,
          subtotal,
          desconto: 0,
          taxaEntrega: 0,
          total: subtotal,
          itens: { create: [{ ...item, precoUnitarioCongelado: precoUnitario, tenantId }] },
        },
      });
      criados.push(pedido);
    }
  }

  // Autossalva nomes informados pra aparecerem como sugestão no próximo
  // pedido — best effort, não impede o pedido se algum nome colidir por acaso.
  const nomesUnicos = [...new Set(lotesNormalizados.flatMap((l) => l.nomes))];
  for (const nome of nomesUnicos) {
    await tx.empresaFuncionario.upsert({
      where: { empresaId_nome: { empresaId: empresa.id, nome } },
      update: { ativo: true },
      create: { tenantId, empresaId: empresa.id, nome },
    });
  }

  return criados;
}

/**
 * Cria um pedido de empresa composto por um ou mais lotes.
 * Corpo esperado: { lotes: [
 *   { produtoId, quantidade, endereco?, nomes?: string[] } |
 *   { tamanhoMarmitaId (slug 'pequena'/'grande'), proteinaIds, complementoIds, quantidade, endereco?, nomes?: string[] }
 * ] }
 */
async function criarLote(req, res) {
  try {
    const { lotes } = req.body;
    const resultado = await req.prisma.$transaction((tx) =>
      criarLoteParaEmpresa(tx, req.tenantId, req.empresa.id, { lotes }),
    );
    res.status(201).json({ criados: resultado.length, pedidos: resultado.map((p) => ({ id: p.id, nomeCliente: p.nomeCliente, total: p.total })) });
  } catch (err) {
    if (err instanceof Erro400) {
      return res.status(400).json({ erro: err.message });
    }
    console.error('Erro ao criar lote de pedidos da empresa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Lista os nomes de funcionários salvos da empresa logada, pra preencher os chips de sugestão. */
async function listarFuncionarios(req, res) {
  try {
    const funcionarios = await req.prisma.empresaFuncionario.findMany({
      where: { empresaId: req.empresa.id, ativo: true },
      orderBy: { nome: 'asc' },
    });
    res.json(funcionarios);
  } catch (err) {
    console.error('Erro ao listar funcionários salvos:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Salva (ou reativa) um nome de funcionário pra empresa logada, fora do fluxo de lote. */
async function salvarFuncionario(req, res) {
  try {
    const nome = String(req.body.nome || '').trim();
    if (!nome || nome.length > 100) {
      return res.status(400).json({ erro: 'Informe um nome válido (até 100 caracteres)' });
    }
    const funcionario = await req.prisma.empresaFuncionario.upsert({
      where: { empresaId_nome: { empresaId: req.empresa.id, nome } },
      update: { ativo: true },
      create: { tenantId: req.tenantId, empresaId: req.empresa.id, nome },
    });
    res.status(201).json(funcionario);
  } catch (err) {
    console.error('Erro ao salvar funcionário:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Remove (desativa) um nome de funcionário salvo da empresa logada. */
async function removerFuncionario(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const funcionario = await req.prisma.empresaFuncionario.findFirst({ where: { id, empresaId: req.empresa.id } });
    if (!funcionario) {
      return res.status(404).json({ erro: 'Funcionário não encontrado' });
    }
    await req.prisma.empresaFuncionario.update({ where: { id }, data: { ativo: false } });
    res.status(204).send();
  } catch (err) {
    console.error('Erro ao remover funcionário:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { cardapio, meusPedidosHoje, criarLote, criarLoteParaEmpresa, listarFuncionarios, salvarFuncionario, removerFuncionario };
