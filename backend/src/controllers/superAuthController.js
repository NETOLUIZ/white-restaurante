const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prismaBase } = require('../lib/prismaBase');
const { verificarBloqueio, registrarFalha, limparFalhas } = require('../utils/loginThrottle');

const NOME_COOKIE = 'ba_super_token';
const COOKIE_MAX_IDADE_MS = 2 * 60 * 60 * 1000; // 2h — TTL menor que os 12h dos demais papéis, de propósito.

/** Opções do cookie do super admin — httpOnly, sem domain (mesma regra dos demais papéis). */
function opcoesCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_IDADE_MS,
  };
}

/** Login do super admin — único papel com email globalmente único (não pertence a tenant nenhum). */
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

    const superAdmin = await prismaBase.superAdmin.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!superAdmin || !superAdmin.ativo) {
      registrarFalha(email);
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const senhaValida = await bcrypt.compare(senha, superAdmin.senha);
    if (!senhaValida) {
      registrarFalha(email);
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }
    limparFalhas(email);

    const token = jwt.sign({ id: superAdmin.id, email: superAdmin.email, tipo: 'super' }, process.env.JWT_SECRET, {
      expiresIn: '2h',
    });

    res.cookie(NOME_COOKIE, token, opcoesCookie());
    res.json({ superAdmin: { id: superAdmin.id, nome: superAdmin.nome, email: superAdmin.email } });
  } catch (err) {
    console.error('Erro no login do super admin:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

function logout(req, res) {
  res.clearCookie(NOME_COOKIE, opcoesCookie());
  res.json({ ok: true });
}

/** Confirma se a sessão do super admin (cookie) ainda é válida. */
async function me(req, res) {
  const superAdmin = await prismaBase.superAdmin.findUnique({ where: { id: req.superAdmin.id } });
  if (!superAdmin || !superAdmin.ativo) {
    return res.status(401).json({ erro: 'Sessao invalida' });
  }
  res.json({ superAdmin: { id: superAdmin.id, nome: superAdmin.nome, email: superAdmin.email } });
}

/** Troca a senha do super admin logado — exige a senha atual correta. */
async function alterarSenha(req, res) {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ erro: 'Informe a senha atual e a nova senha' });
    }
    if (String(novaSenha).length < 6) {
      return res.status(400).json({ erro: 'A nova senha precisa de ao menos 6 caracteres' });
    }

    const superAdmin = await prismaBase.superAdmin.findUnique({ where: { id: req.superAdmin.id } });
    const senhaValida = await bcrypt.compare(senhaAtual, superAdmin.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Senha atual incorreta' });
    }

    const senhaHash = await bcrypt.hash(String(novaSenha), 12);
    await prismaBase.superAdmin.update({ where: { id: superAdmin.id }, data: { senha: senhaHash, senhaAlteradaEm: new Date() } });

    // senhaAlteradaEm invalida qualquer token emitido antes dela (ver tokenAindaValido
    // em middleware/superAuth.js) — sem reemitir aqui, o PRÓPRIO cookie que acabou de
    // trocar a senha vira inválido na resposta seguinte, derrubando a sessão sem aviso.
    const token = jwt.sign({ id: superAdmin.id, email: superAdmin.email, tipo: 'super' }, process.env.JWT_SECRET, {
      expiresIn: '2h',
    });
    res.cookie(NOME_COOKIE, token, opcoesCookie());
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao trocar senha do super admin:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { login, logout, me, alterarSenha };
