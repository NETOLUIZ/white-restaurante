const jwt = require('jsonwebtoken');

const NOME_COOKIE = 'ba_impersonacao';
const TTL_MS = 30 * 60 * 1000; // 30min — sessão de impersonation é curta de propósito

function opcoesCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TTL_MS,
  };
}

/**
 * Resgata um código de impersonation de uso único (emitido por
 * POST /api/super/tenants/:id/impersonar) e abre a sessão como admin do
 * tenant atual. `req.prisma.impersonacaoCodigo.findFirst({where:{codigo}})`
 * já vem escopado ao tenant do subdomínio atual pela extension — um código
 * emitido pra outro tenant nunca é encontrado aqui, sem checagem manual.
 */
async function impersonar(req, res) {
  try {
    const { codigo } = req.body;
    if (!codigo) {
      return res.status(400).json({ erro: 'Código é obrigatório' });
    }

    const registro = await req.prisma.impersonacaoCodigo.findFirst({ where: { codigo } });
    if (!registro || registro.usadoEm || registro.expiraEm < new Date()) {
      return res.status(401).json({ erro: 'Código inválido ou expirado' });
    }

    await req.prisma.impersonacaoCodigo.update({ where: { id: registro.id }, data: { usadoEm: new Date() } });

    // Sem FK direta entre ImpersonacaoCodigo e LogImpersonacao no schema — o
    // log mais recente ainda aberto pro mesmo super admin/tenant é o que foi
    // criado junto com este código (ver superImpersonacaoController.impersonar).
    const log = await req.prisma.logImpersonacao.findFirst({
      where: { superAdminId: registro.superAdminId, encerradoEm: null },
      orderBy: { iniciadoEm: 'desc' },
    });

    const token = jwt.sign(
      { superAdminId: registro.superAdminId, tenantId: req.tenantId, logId: log ? log.id : null, tipo: 'impersonacao' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' },
    );
    res.cookie(NOME_COOKIE, token, opcoesCookie());
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao resgatar código de impersonation:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Encerra a sessão de impersonation — limpa o cookie e fecha o log de auditoria. */
async function encerrarImpersonacao(req, res) {
  try {
    if (req.impersonando && req.logId) {
      await req.prisma.logImpersonacao.update({ where: { id: req.logId }, data: { encerradoEm: new Date() } });
    }
    res.clearCookie(NOME_COOKIE, opcoesCookie());
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao encerrar impersonation:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { impersonar, encerrarImpersonacao };
