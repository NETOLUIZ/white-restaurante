const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../utils/db');
const { verificarBloqueio, registrarFalha, limparFalhas } = require('../utils/loginThrottle');

const NOME_COOKIE = 'bel_do_frango_atu_entregador_token';
const COOKIE_MAX_IDADE_MS = 12 * 60 * 60 * 1000; // 12h, mesma duracao do token

/** Opcoes do cookie do token de entregador — httpOnly, igual ao padrão usado pro admin/garçom. */
function opcoesCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_IDADE_MS,
  };
}

/** Login do entregador — sessão própria, nunca dá acesso às rotas de admin/garçom. */
async function login(req, res) {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha sao obrigatorios' });
    }

    const segundosRestantes = verificarBloqueio(email);
    if (segundosRestantes) {
      return res.status(429).json({ erro: `Muitas tentativas para esta conta. Tente novamente em ${segundosRestantes}s.` });
    }

    const entregador = await prisma.entregador.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!entregador || !entregador.ativo) {
      registrarFalha(email);
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const senhaValida = await bcrypt.compare(senha, entregador.senha);
    if (!senhaValida) {
      registrarFalha(email);
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }
    limparFalhas(email);

    const token = jwt.sign({ id: entregador.id, email: entregador.email }, process.env.JWT_SECRET, {
      expiresIn: '12h',
    });

    res.cookie(NOME_COOKIE, token, opcoesCookie());
    res.json({ entregador: { id: entregador.id, nome: entregador.nome, email: entregador.email } });
  } catch (err) {
    console.error('Erro no login do entregador:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

function logout(req, res) {
  res.clearCookie(NOME_COOKIE, opcoesCookie());
  res.json({ ok: true });
}

/** Confirma se a sessão do entregador (cookie) ainda é válida — usado pela tela ao carregar. */
async function me(req, res) {
  const entregador = await prisma.entregador.findUnique({ where: { id: req.entregador.id } });
  if (!entregador || !entregador.ativo) {
    return res.status(401).json({ erro: 'Sessao invalida' });
  }
  res.json({ entregador: { id: entregador.id, nome: entregador.nome, email: entregador.email } });
}

/** Troca a senha do entregador logado — exige a senha atual correta. */
async function alterarSenha(req, res) {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ erro: 'Informe a senha atual e a nova senha' });
    }
    if (String(novaSenha).length < 6) {
      return res.status(400).json({ erro: 'A nova senha precisa de ao menos 6 caracteres' });
    }

    const entregador = await prisma.entregador.findUnique({ where: { id: req.entregador.id } });
    const senhaValida = await bcrypt.compare(senhaAtual, entregador.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Senha atual incorreta' });
    }

    const senhaHash = await bcrypt.hash(String(novaSenha), 12);
    await prisma.entregador.update({ where: { id: entregador.id }, data: { senha: senhaHash, senhaAlteradaEm: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao trocar senha do entregador:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { login, logout, me, alterarSenha };
