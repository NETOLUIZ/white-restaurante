const { prismaBase } = require('../lib/prismaBase');
const { prismaParaTenant } = require('../lib/prismaTenant');
const { montarBackupTenant, restaurarBackupTenant, VERSAO_BACKUP } = require('../utils/backup');

function nomeArquivo(extensao) {
  const data = new Date().toISOString().slice(0, 10);
  return `backup-plataforma-${data}.${extensao}`;
}

async function montarBackupPlataforma() {
  const tenants = await prismaBase.tenant.findMany();
  const backupsPorTenant = await Promise.all(
    tenants.map((tenant) => montarBackupTenant(prismaParaTenant(tenant.id), tenant)),
  );
  return {
    versao: VERSAO_BACKUP,
    exportadoEm: new Date().toISOString(),
    tenants: backupsPorTenant,
  };
}

/** Exporta o backup de TODOS os tenants da plataforma — disaster recovery. */
async function exportarJson(req, res) {
  try {
    const backup = await montarBackupPlataforma();
    res.set('Content-Type', 'application/json');
    res.set('Content-Disposition', `attachment; filename="${nomeArquivo('json')}"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error('Erro ao exportar backup da plataforma:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Exporta um PDF resumido da plataforma inteira — contagem por loja, não o
 * catálogo linha a linha (esse detalhe já está no JSON, e no PDF individual
 * que cada tenant pode gerar no próprio Admin).
 */
async function exportarPdf(req, res) {
  try {
    const backup = await montarBackupPlataforma();
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${nomeArquivo('pdf')}"`);
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);
    doc.fontSize(18).text('Backup da plataforma — Korentech');
    doc.fontSize(11).fillColor('#666').text('Exportado em ' + new Date(backup.exportadoEm).toLocaleString('pt-BR'));
    doc.fillColor('#000');
    doc.moveDown(1);
    backup.tenants.forEach((t) => {
      if (doc.y > 700) doc.addPage();
      doc.fontSize(13).text(`${t.tenant.nome} (${t.tenant.slug}) — ${t.tenant.tipo}`);
      doc.fontSize(9).fillColor('#333').text(
        `${t.categorias.length} categorias · ${t.produtos.length} produtos · ${t.cupons.length} cupons · ` +
        `${t.bairros.length} bairros · ${t.mesas.length} mesas · ${t.empresas.length} empresas`,
      );
      doc.fillColor('#000');
      doc.moveDown(0.6);
    });
    doc.moveDown(1);
    doc.fontSize(8).fillColor('#999').text(
      'Relatório resumido — o catálogo completo de cada loja está no arquivo .json exportado junto.',
    );
    doc.end();
  } catch (err) {
    console.error('Erro ao gerar PDF de backup da plataforma:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Restaura TODOS os tenants de um backup de plataforma — tenant é
 * identificado pelo slug (cria se não existir mais). Tudo numa transação
 * só: se algum tenant falhar no meio, nada é restaurado.
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
    if (!dados || dados.versao !== VERSAO_BACKUP || !Array.isArray(dados.tenants)) {
      return res.status(400).json({ erro: 'Arquivo de backup de plataforma inválido ou de versão incompatível' });
    }

    await prismaBase.$transaction(async (tx) => {
      for (const backupTenant of dados.tenants) {
        const { slug, nome, tipo } = backupTenant.tenant;
        const tenant = await tx.tenant.upsert({
          where: { slug },
          update: { nome, tipo },
          create: { slug, nome, tipo },
        });
        await restaurarBackupTenant(tx, backupTenant, tenant.id);
      }
    }, { timeout: 60000 });

    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao restaurar backup da plataforma:', err);
    res.status(400).json({ erro: err.message || 'Erro ao restaurar backup' });
  }
}

module.exports = { exportarJson, exportarPdf, restaurar };
