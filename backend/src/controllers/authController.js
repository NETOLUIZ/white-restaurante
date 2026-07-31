const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../utils/db');
const { verificarBloqueio, registrarFalha, limparFalhas } = require('../utils/loginThrottle');

const NOME_COOKIE = 'bel_do_frango_atu_admin_token';
const COOKIE_MAX_IDADE_MS = 12 * 60 * 60 * 1000; // 12h, mesma duracao do token

/** Opcoes do cookie do token de admin — httpOnly pra nao ser lido via JS (XSS), secure em produção. */
function opcoesCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_IDADE_MS,
  };
}

/**
 * Login do admin. O token JWT vai num cookie httpOnly, nunca no corpo da
 * resposta nem em localStorage/sessionStorage do client.
 */
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

    const admin = await prisma.admin.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!admin) {
      registrarFalha(email);
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const senhaValida = await bcrypt.compare(senha, admin.senha);
    if (!senhaValida) {
      registrarFalha(email);
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }
    limparFalhas(email);

    const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, {
      expiresIn: '12h',
    });

    res.cookie(NOME_COOKIE, token, opcoesCookie());
    res.json({ admin: { id: admin.id, nome: admin.nome, email: admin.email } });
  } catch (err) {
    console.error('Erro no login do admin:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Limpa o cookie de sessão. */
function logout(req, res) {
  res.clearCookie(NOME_COOKIE, opcoesCookie());
  res.json({ ok: true });
}

/** Confirma se a sessão do admin (cookie) ainda é válida — usado pelo frontend ao carregar o painel. */
function me(req, res) {
  res.json({ admin: req.admin });
}

/** Troca a senha do admin logado — exige a senha atual correta. */
async function alterarSenha(req, res) {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ erro: 'Informe a senha atual e a nova senha' });
    }
    if (String(novaSenha).length < 6) {
      return res.status(400).json({ erro: 'A nova senha precisa de ao menos 6 caracteres' });
    }

    const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } });
    const senhaValida = await bcrypt.compare(senhaAtual, admin.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Senha atual incorreta' });
    }

    const senhaHash = await bcrypt.hash(String(novaSenha), 12);
    await prisma.admin.update({ where: { id: admin.id }, data: { senha: senhaHash, senhaAlteradaEm: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao trocar senha do admin:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { login, logout, me, alterarSenha };
