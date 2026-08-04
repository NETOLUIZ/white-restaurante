const bcrypt = require('bcryptjs');

const SELECT_SEM_SENHA = { id: true, nome: true, email: true, ativo: true, createdAt: true, updatedAt: true };

/** Lista todos os entregadores — painel admin. Nunca inclui o hash da senha. */
async function listarAdmin(req, res) {
  try {
    const entregadores = await req.prisma.entregador.findMany({ orderBy: { nome: 'asc' }, select: SELECT_SEM_SENHA });
    res.json(entregadores);
  } catch (err) {
    console.error('Erro ao listar entregadores:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Cria um entregador com login próprio (email/senha) — painel admin. */
async function criar(req, res) {
  try {
    const nome = String(req.body.nome || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ erro: 'A senha precisa de ao menos 6 caracteres' });
    }
    const senhaHash = await bcrypt.hash(senha, 12);
    const entregador = await req.prisma.entregador.create({
      data: { nome, email, senha: senhaHash },
      select: SELECT_SEM_SENHA,
    });
    res.status(201).json(entregador);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um entregador com esse email' });
    }
    console.error('Erro ao criar entregador:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza nome/email/ativo e, opcionalmente, redefine a senha de um entregador — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.impersonando && req.body.senha) {
      return res.status(403).json({ erro: 'Redefinir senha não é permitido durante impersonation' });
    }
    const dados = {};
    if (req.body.nome !== undefined) dados.nome = String(req.body.nome).trim();
    if (req.body.email !== undefined) dados.email = String(req.body.email).trim().toLowerCase();
    if (req.body.ativo !== undefined) dados.ativo = Boolean(req.body.ativo);
    if (req.body.senha) {
      if (String(req.body.senha).length < 6) {
        return res.status(400).json({ erro: 'A senha precisa de ao menos 6 caracteres' });
      }
      dados.senha = await bcrypt.hash(String(req.body.senha), 12);
      dados.senhaAlteradaEm = new Date();
    }
    const entregador = await req.prisma.entregador.update({ where: { id }, data: dados, select: SELECT_SEM_SENHA });
    res.json(entregador);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um entregador com esse email' });
    }
    console.error('Erro ao atualizar entregador:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Pedidos SAIU_ENTREGA atribuídos ao entregador autenticado — usado pela
 * tela do entregador depois do login (sessão via cookie, não mais por token na URL).
 */
async function meusPedidos(req, res) {
  try {
    const pedidos = await req.prisma.pedido.findMany({
      where: { entregadorId: req.entregador.id, statusEntrega: 'SAIU_ENTREGA' },
      include: {
        itens: { include: { produto: true, tamanhoMarmita: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(
      pedidos.map((p) => ({
        id: p.id,
        nomeCliente: p.nomeCliente,
        telefone: p.telefone,
        endereco: p.endereco,
        valorTrocoPara: p.valorTrocoPara,
        itens: p.itens.map((it) => ({
          nome: it.produto ? it.produto.nome : it.tamanhoMarmita?.nome,
          quantidade: it.quantidade,
        })),
        total: p.total,
        formaPagamento: p.formaPagamento,
      })),
    );
  } catch (err) {
    console.error('Erro ao buscar pedidos do entregador:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Soma dos pedidos pagos em Dinheiro e já ENTREGUES pelo entregador autenticado,
 * desde o último "zerar saldo" do admin (ou desde sempre, se nunca zerou). Não é
 * uma coluna — sempre calculado na hora, pra nunca dessincronizar do estado real
 * dos pedidos.
 */
async function meuSaldo(req, res) {
  try {
    const entregador = await req.prisma.entregador.findFirst({
      where: { id: req.entregador.id },
      select: { saldoZeradoEm: true, createdAt: true },
    });
    const resultado = await req.prisma.pedido.aggregate({
      where: {
        entregadorId: req.entregador.id,
        formaPagamento: 'DINHEIRO',
        statusEntrega: 'ENTREGUE',
        entregueEm: { gt: entregador.saldoZeradoEm || entregador.createdAt },
      },
      _sum: { total: true },
    });
    res.json({ saldo: resultado._sum.total || 0 });
  } catch (err) {
    console.error('Erro ao calcular saldo do entregador:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Lista todos os entregadores do tenant com o saldo atual de cada um — painel admin. */
async function listarSaldos(req, res) {
  try {
    const entregadores = await req.prisma.entregador.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, ativo: true, saldoZeradoEm: true, createdAt: true },
    });
    const saldos = await Promise.all(
      entregadores.map(async (e) => {
        const resultado = await req.prisma.pedido.aggregate({
          where: {
            entregadorId: e.id,
            formaPagamento: 'DINHEIRO',
            statusEntrega: 'ENTREGUE',
            entregueEm: { gt: e.saldoZeradoEm || e.createdAt },
          },
          _sum: { total: true },
        });
        return { id: e.id, nome: e.nome, ativo: e.ativo, saldo: resultado._sum.total || 0 };
      }),
    );
    res.json(saldos);
  } catch (err) {
    console.error('Erro ao listar saldos dos entregadores:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Zera o saldo de um entregador — painel admin. Não apaga nada, só marca a partir de quando contar de novo. */
async function zerarSaldo(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await req.prisma.entregador.update({ where: { id }, data: { saldoZeradoEm: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao zerar saldo do entregador:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listarAdmin, criar, atualizar, meusPedidos, meuSaldo, listarSaldos, zerarSaldo };
