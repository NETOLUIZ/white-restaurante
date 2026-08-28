const evolutionApi = require('../utils/evolutionApi');

/**
 * Cria (se ainda não existir) a instância do tenant no Evolution API e
 * devolve o QR Code atual pra conectar. Idempotente: chamar de novo antes de
 * escanear só busca um QR Code novo pra MESMA instância.
 */
async function conectar(req, res) {
  try {
    let config = await req.prisma.configuracao.upsert({ where: {}, update: {}, create: {} });
    let instanceName = config.whatsappInstancia;
    if (!instanceName) {
      instanceName = `tenant_${req.tenantId}`;
      const { token } = await evolutionApi.criarInstancia(instanceName);
      config = await req.prisma.configuracao.upsert({
        where: {},
        update: { whatsappInstancia: instanceName, whatsappToken: token, whatsappConectado: false },
        create: { whatsappInstancia: instanceName, whatsappToken: token },
      });
    }
    const { base64 } = await evolutionApi.obterQrCode(instanceName);
    res.json({ qrCode: base64 });
  } catch (err) {
    console.error('Erro ao conectar WhatsApp:', err);
    res.status(500).json({ erro: err.message || 'Erro ao conectar WhatsApp' });
  }
}

/** Consultado em poll pela tela enquanto o QR Code está exibido, esperando o escaneamento. */
async function status(req, res) {
  try {
    const config = await req.prisma.configuracao.findFirst();
    if (!config || !config.whatsappInstancia) {
      return res.json({ conectado: false });
    }
    const estado = await evolutionApi.statusConexao(config.whatsappInstancia);
    const conectado = estado === 'open';
    if (conectado !== config.whatsappConectado) {
      await req.prisma.configuracao.upsert({ where: {}, update: { whatsappConectado: conectado }, create: { whatsappConectado: conectado } });
    }
    res.json({ conectado });
  } catch (err) {
    console.error('Erro ao consultar status do WhatsApp:', err);
    res.status(500).json({ erro: 'Erro ao consultar status do WhatsApp' });
  }
}

async function desconectar(req, res) {
  try {
    const config = await req.prisma.configuracao.findFirst();
    if (config && config.whatsappInstancia) {
      await evolutionApi.desconectarInstancia(config.whatsappInstancia).catch(() => {});
    }
    await req.prisma.configuracao.upsert({ where: {}, update: { whatsappConectado: false }, create: { whatsappConectado: false } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao desconectar WhatsApp:', err);
    res.status(500).json({ erro: 'Erro ao desconectar WhatsApp' });
  }
}

module.exports = { conectar, status, desconectar };
