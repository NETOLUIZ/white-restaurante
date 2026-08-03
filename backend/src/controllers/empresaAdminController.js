const bcrypt = require('bcryptjs');
const { Erro400 } = require('./pedidoController');
const { criarLoteParaEmpresa } = require('./empresaPedidoController');

const SELECT_SEM_SENHA = {
  id: true, nome: true, login: true, cotaDiaria: true, valorMarmita: true, ativo: true, createdAt: true,
  funcionariosSalvos: { where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } },
};

/** Lista todas as empresas (clientes corporativos) — painel admin. Nunca inclui o hash da senha. */
async function listarAdmin(req, res) {
  try {
    const empresas = await req.prisma.empresa.findMany({ orderBy: { nome: 'asc' }, select: SELECT_SEM_SENHA });
    res.json(empresas);
  } catch (err) {
    console.error('Erro ao listar empresas:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Cria uma empresa com login próprio (login/senha) — painel admin. */
async function criar(req, res) {
  try {
    const nome = String(req.body.nome || '').trim();
    const login = String(req.body.login || '').trim().toUpperCase();
    const senha = String(req.body.senha || '');
    const cotaDiaria = req.body.cotaDiaria !== undefined ? parseInt(req.body.cotaDiaria, 10) : 20;
    const valorMarmita = req.body.valorMarmita !== undefined ? Number(req.body.valorMarmita) : 0;
    if (!nome || !login || !senha) {
      return res.status(400).json({ erro: 'Nome, login e senha são obrigatórios' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ erro: 'A senha precisa de ao menos 6 caracteres' });
    }
    if (!Number.isFinite(valorMarmita) || valorMarmita < 0) {
      return res.status(400).json({ erro: 'Valor da marmita inválido' });
    }
    const senhaHash = await bcrypt.hash(senha, 12);
    const empresa = await req.prisma.empresa.create({
      data: {
        nome, login, senha: senhaHash,
        cotaDiaria: Number.isInteger(cotaDiaria) && cotaDiaria > 0 ? cotaDiaria : 20,
        valorMarmita: Number(valorMarmita.toFixed(2)),
      },
      select: SELECT_SEM_SENHA,
    });
    res.status(201).json(empresa);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe uma empresa com esse login' });
    }
    console.error('Erro ao criar empresa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza nome/login/cotaDiaria/ativo e, opcionalmente, redefine a senha de uma empresa — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.impersonando && req.body.senha) {
      return res.status(403).json({ erro: 'Redefinir senha não é permitido durante impersonation' });
    }
    const dados = {};
    if (req.body.nome !== undefined) dados.nome = String(req.body.nome).trim();
    if (req.body.login !== undefined) dados.login = String(req.body.login).trim().toUpperCase();
    if (req.body.cotaDiaria !== undefined) dados.cotaDiaria = Math.max(1, parseInt(req.body.cotaDiaria, 10) || 20);
    if (req.body.valorMarmita !== undefined) {
      const valorMarmita = Number(req.body.valorMarmita);
      if (!Number.isFinite(valorMarmita) || valorMarmita < 0) {
        return res.status(400).json({ erro: 'Valor da marmita inválido' });
      }
      dados.valorMarmita = Number(valorMarmita.toFixed(2));
    }
    if (req.body.ativo !== undefined) dados.ativo = Boolean(req.body.ativo);
    if (req.body.senha) {
      if (String(req.body.senha).length < 6) {
        return res.status(400).json({ erro: 'A senha precisa de ao menos 6 caracteres' });
      }
      dados.senha = await bcrypt.hash(String(req.body.senha), 12);
      dados.senhaAlteradaEm = new Date();
    }
    const empresa = await req.prisma.empresa.update({ where: { id }, data: dados, select: SELECT_SEM_SENHA });
    res.json(empresa);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe uma empresa com esse login' });
    }
    console.error('Erro ao atualizar empresa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Admin lança um pedido em lote em nome da empresa (ex: cliente ligou pedindo por telefone). */
async function criarPedidoAdmin(req, res) {
  try {
    const empresaId = parseInt(req.params.id, 10);
    const { lotes } = req.body;
    const resultado = await req.prisma.$transaction((tx) =>
      criarLoteParaEmpresa(tx, req.tenantId, empresaId, { lotes }),
    );
    res.status(201).json({ criados: resultado.length, pedidos: resultado.map((p) => ({ id: p.id, nomeCliente: p.nomeCliente, total: p.total })) });
  } catch (err) {
    if (err instanceof Erro400) {
      return res.status(400).json({ erro: err.message });
    }
    console.error('Erro ao criar pedido em nome da empresa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Remove (desativa) um nome de funcionário salvo de uma empresa — painel admin. */
async function removerFuncionario(req, res) {
  try {
    const empresaId = parseInt(req.params.id, 10);
    const funcId = parseInt(req.params.funcId, 10);
    const funcionario = await req.prisma.empresaFuncionario.findFirst({ where: { id: funcId, empresaId } });
    if (!funcionario) {
      return res.status(404).json({ erro: 'Funcionário não encontrado para esta empresa' });
    }
    await req.prisma.empresaFuncionario.update({ where: { id: funcId }, data: { ativo: false } });
    res.status(204).send();
  } catch (err) {
    console.error('Erro ao remover funcionário salvo:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listarAdmin, criar, atualizar, criarPedidoAdmin, removerFuncionario };
