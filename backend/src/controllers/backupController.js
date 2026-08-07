const { montarBackupTenant, restaurarBackupTenant } = require('../utils/backup');
const { gerarPdfCatalogo } = require('../utils/backupPdf');

function nomeArquivo(slug, extensao) {
  const data = new Date().toISOString().slice(0, 10);
  return `backup-${slug}-${data}.${extensao}`;
}

/** Exporta o backup (catálogo + config + contas de acesso) do tenant logado como .json. */
async function exportarJson(req, res) {
  try {
    const backup = await montarBackupTenant(req.prisma, req.tenant);
    res.set('Content-Type', 'application/json');
    res.set('Content-Disposition', `attachment; filename="${nomeArquivo(req.tenant.slug, 'json')}"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error('Erro ao exportar backup:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Exporta um relatório em PDF (só leitura, não serve pra restaurar) do catálogo do tenant logado. */
async function exportarPdf(req, res) {
  try {
    const backup = await montarBackupTenant(req.prisma, req.tenant);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${nomeArquivo(req.tenant.slug, 'pdf')}"`);
    gerarPdfCatalogo(res, backup);
  } catch (err) {
    console.error('Erro ao gerar PDF de backup:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Restaura o tenant logado a partir de um arquivo .json de backup — sempre
 * aditivo (ver utils/backup.js), então nunca apaga o que já existe. Sempre
 * dentro de uma transação: se qualquer registro falhar no meio, nada fica
 * restaurado pela metade.
 */
async function restaurar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado (campo esperado: "arquivo")' });
    }
    let dados;
    try {
      dados = JSON.parse(req.file.buffer.toString('utf-8'));
    } catch {
      return res.status(400).json({ erro: 'Arquivo não é um JSON válido' });
    }
    await req.prisma.$transaction(
      (tx) => restaurarBackupTenant(tx, dados, req.tenantId),
      { timeout: 30000 },
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao restaurar backup:', err);
    res.status(400).json({ erro: err.message || 'Erro ao restaurar backup' });
  }
}

module.exports = { exportarJson, exportarPdf, restaurar };
