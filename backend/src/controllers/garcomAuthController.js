const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { verificarBloqueio, registrarFalha, limparFalhas } = require('../utils/loginThrottle');

const NOME_COOKIE = 'ba_garcom_token';
const COOKIE_MAX_IDADE_MS = 12 * 60 * 60 * 1000; // 12h, mesma duracao do token

/** Opcoes do cookie do token de garçom — httpOnly, igual ao padrão usado pro admin. */
function opcoesCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_IDADE_MS,
  };
}

/** Login do garçom — sessão própria, nunca dá acesso às rotas de admin. */
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

    const garcom = await req.prisma.garcom.findFirst({ where: { email: String(email).trim().toLowerCase() } });
    if (!garcom || !garcom.ativo) {
      registrarFalha(email);
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const senhaValida = await bcrypt.compare(senha, garcom.senha);
    if (!senhaValida) {
      registrarFalha(email);
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }
    limparFalhas(email);

    const token = jwt.sign({ id: garcom.id, email: garcom.email, tenantId: req.tenantId }, process.env.JWT_SECRET, {
      expiresIn: '12h',
    });

    res.cookie(NOME_COOKIE, token, opcoesCookie());
    res.json({ garcom: { id: garcom.id, nome: garcom.nome, email: garcom.email } });
  } catch (err) {
    console.error('Erro no login do garçom:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

function logout(req, res) {
  res.clearCookie(NOME_COOKIE, opcoesCookie());
  res.json({ ok: true });
}

/** Confirma se a sessão do garçom (cookie) ainda é válida — usado pela tela ao carregar. */
async function me(req, res) {
  const garcom = await req.prisma.garcom.findFirst({ where: { id: req.garcom.id } });
  if (!garcom || !garcom.ativo) {
    return res.status(401).json({ erro: 'Sessao invalida' });
  }
  res.json({ garcom: { id: garcom.id, nome: garcom.nome, email: garcom.email } });
}

/** Troca a senha do garçom logado — exige a senha atual correta. */
async function alterarSenha(req, res) {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ erro: 'Informe a senha atual e a nova senha' });
    }
    if (String(novaSenha).length < 6) {
      return res.status(400).json({ erro: 'A nova senha precisa de ao menos 6 caracteres' });
    }

    const garcom = await req.prisma.garcom.findFirst({ where: { id: req.garcom.id } });
    const senhaValida = await bcrypt.compare(senhaAtual, garcom.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Senha atual incorreta' });
    }

    const senhaHash = await bcrypt.hash(String(novaSenha), 12);
    await req.prisma.garcom.update({ where: { id: garcom.id }, data: { senha: senhaHash, senhaAlteradaEm: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao trocar senha do garçom:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { login, logout, me, alterarSenha };
