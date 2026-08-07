const { consultarPagamento } = require('../utils/mercadoPago');

/**
 * Webhook do Mercado Pago — chamado pelo MP (não pelo cliente/admin) quando o
 * status de um pagamento muda. Chega no subdomínio do próprio tenant (a URL
 * é montada em pedidoController.criar com o slug dele), então req.prisma já
 * vem escopado certo, igual qualquer outra rota pública.
 *
 * Nunca confia no corpo do webhook pra decidir "foi pago" — o corpo só diz
 * QUAL pagamento mudou; sempre reconsulta a API do Mercado Pago com o token
 * do próprio tenant antes de marcar como confirmado. Sempre responde 200
 * (mesmo em erro/pagamento não achado) — responder erro faz o MP re-tentar
 * em loop, e não há nada de sensível pra esconder aqui.
 */
async function webhookMercadoPago(req, res) {
  try {
    const paymentId = req.body?.data?.id || req.query['data.id'] || req.query.id;
    const tipo = req.body?.type || req.query.type;
    if (tipo !== 'payment' || !paymentId) {
      return res.status(200).json({ ok: true });
    }

    const config = await req.prisma.configuracao.findFirst();
    if (!config?.mercadoPagoAccessToken) {
      return res.status(200).json({ ok: true });
    }

    const pagamento = await consultarPagamento({ accessToken: config.mercadoPagoAccessToken, paymentId });
    if (pagamento.status !== 'approved') {
      return res.status(200).json({ ok: true });
    }

    const pedido = await req.prisma.pedido.findFirst({ where: { pagamentoExternoId: pagamento.id } });
    if (pedido && !pedido.pagamentoConfirmado) {
      await req.prisma.pedido.update({ where: { id: pedido.id }, data: { pagamentoConfirmado: true } });
      console.log(`[pix] pagamento confirmado — pedido id=${pedido.id}`);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro no webhook do Mercado Pago:', err.message);
    res.status(200).json({ ok: true });
  }
}

module.exports = { webhookMercadoPago };
