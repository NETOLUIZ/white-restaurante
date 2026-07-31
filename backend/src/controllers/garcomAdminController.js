const bcrypt = require('bcryptjs');
const { prisma } = require('../utils/db');

const SELECT_SEM_SENHA = { id: true, nome: true, email: true, ativo: true, createdAt: true };

/** Lista todos os garçons — painel admin. Nunca inclui o hash da senha. */
async function listarAdmin(req, res) {
  try {
    const garcons = await prisma.garcom.findMany({ orderBy: { nome: 'asc' }, select: SELECT_SEM_SENHA });
    res.json(garcons);
  } catch (err) {
    console.error('Erro ao listar garçons:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Cria um garçom com login próprio (email/senha) — painel admin. */
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
    const garcom = await prisma.garcom.create({
      data: { nome, email, senha: senhaHash },
      select: SELECT_SEM_SENHA,
    });
    res.status(201).json(garcom);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um garçom com esse email' });
    }
    console.error('Erro ao criar garçom:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Atualiza nome/email/ativo e, opcionalmente, redefine a senha de um garçom — painel admin. */
async function atualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
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
    const garcom = await prisma.garcom.update({ where: { id }, data: dados, select: SELECT_SEM_SENHA });
    res.json(garcom);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um garçom com esse email' });
    }
    console.error('Erro ao atualizar garçom:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listarAdmin, criar, atualizar };
