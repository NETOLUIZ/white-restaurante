const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { verificarBloqueio, registrarFalha, limparFalhas } = require('../utils/loginThrottle');

const NOME_COOKIE = 'ba_empresa_token';
const COOKIE_MAX_IDADE_MS = 12 * 60 * 60 * 1000; // 12h, mesma duracao do token

/** Opcoes do cookie do token de empresa — httpOnly, igual ao padrão usado pros demais papéis. */
function opcoesCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_IDADE_MS,
  };
}

/** Login da empresa (cliente corporativo) — sessão própria, nunca dá acesso a nenhuma outra rota de papel. */
async function login(req, res) {
  try {
    const { login: loginInformado, senha } = req.body;
    if (!loginInformado || !senha) {
      return res.status(400).json({ erro: 'Login e senha sao obrigatorios' });
    }

    const loginNormalizado = String(loginInformado).trim().toUpperCase();
    const segundosRestantes = verificarBloqueio(loginNormalizado);
    if (segundosRestantes) {
      return res.status(429).json({ erro: `Muitas tentativas para esta conta. Tente novamente em ${segundosRestantes}s.` });
    }

    const empresa = await req.prisma.empresa.findFirst({ where: { login: loginNormalizado } });
    if (!empresa || !empresa.ativo) {
      registrarFalha(loginNormalizado);
      return res.status(401).json({ erro: 'Login ou senha incorretos' });
    }

    const senhaValida = await bcrypt.compare(senha, empresa.senha);
    if (!senhaValida) {
      registrarFalha(loginNormalizado);
      return res.status(401).json({ erro: 'Login ou senha incorretos' });
    }
    limparFalhas(loginNormalizado);

    const token = jwt.sign({ id: empresa.id, login: empresa.login, tenantId: req.tenantId }, process.env.JWT_SECRET, {
      expiresIn: '12h',
    });

    res.cookie(NOME_COOKIE, token, opcoesCookie());
    res.json({ empresa: { id: empresa.id, nome: empresa.nome, login: empresa.login, cotaDiaria: empresa.cotaDiaria } });
  } catch (err) {
    console.error('Erro no login da empresa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

function logout(req, res) {
  res.clearCookie(NOME_COOKIE, opcoesCookie());
  res.json({ ok: true });
}

/** Confirma se a sessão da empresa (cookie) ainda é válida — usado pela tela ao carregar. */
async function me(req, res) {
  const empresa = await req.prisma.empresa.findFirst({ where: { id: req.empresa.id } });
  if (!empresa || !empresa.ativo) {
    return res.status(401).json({ erro: 'Sessao invalida' });
  }
  res.json({ empresa: { id: empresa.id, nome: empresa.nome, login: empresa.login, cotaDiaria: empresa.cotaDiaria } });
}

/** Troca a senha da empresa logada — exige a senha atual correta. */
async function alterarSenha(req, res) {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ erro: 'Informe a senha atual e a nova senha' });
    }
    if (String(novaSenha).length < 6) {
      return res.status(400).json({ erro: 'A nova senha precisa de ao menos 6 caracteres' });
    }

    const empresa = await req.prisma.empresa.findFirst({ where: { id: req.empresa.id } });
    const senhaValida = await bcrypt.compare(senhaAtual, empresa.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Senha atual incorreta' });
    }

    const senhaHash = await bcrypt.hash(String(novaSenha), 12);
    await req.prisma.empresa.update({ where: { id: empresa.id }, data: { senha: senhaHash, senhaAlteradaEm: new Date() } });

    // senhaAlteradaEm invalida qualquer token emitido antes dela — sem reemitir aqui, o
    // PRÓPRIO cookie que acabou de trocar a senha vira inválido na resposta seguinte,
    // derrubando a sessão sem aviso.
    const token = jwt.sign({ id: empresa.id, login: empresa.login, tenantId: req.tenantId }, process.env.JWT_SECRET, {
      expiresIn: '12h',
    });
    res.cookie(NOME_COOKIE, token, opcoesCookie());
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao trocar senha da empresa:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { login, logout, me, alterarSenha };
