const PDFDocument = require('pdfkit');

function fmtMoeda(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

/**
 * Gera um PDF de leitura (relatório do catálogo) a partir dos mesmos dados
 * do backup JSON — NUNCA é usado para restaurar (PDF não é reimportável de
 * forma confiável), é só pra guardar/imprimir/conferir. Quem restaura o
 * sistema é o .json (ver backup.js).
 */
function gerarPdfCatalogo(res, backup) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(18).text(backup.tenant.nome, { continued: false });
  doc.fontSize(11).fillColor('#666').text('Relatório de backup — catálogo e configuração');
  doc.text('Exportado em ' + new Date(backup.exportadoEm).toLocaleString('pt-BR'));
  doc.fillColor('#000');
  doc.moveDown(1);

  doc.fontSize(13).text('Resumo');
  doc.fontSize(10).fillColor('#333');
  const resumo = [
    ['Categorias', backup.categorias.length],
    ['Produtos', backup.produtos.length],
    ['Proteínas (marmita)', backup.proteinas.length],
    ['Complementos (marmita)', backup.complementos.length],
    ['Cupons', backup.cupons.length],
    ['Bairros de entrega', backup.bairros.length],
    ['Mesas', backup.mesas.length],
    ['Empresas (canal corporativo)', backup.empresas.length],
    ['Contas de acesso (admin/garçom/atendente/entregador)',
      backup.admins.length + backup.garcons.length + backup.atendentes.length + backup.entregadores.length],
  ];
  resumo.forEach(([label, valor]) => doc.text(`${label}: ${valor}`));
  doc.fillColor('#000');
  doc.moveDown(1);

  doc.fontSize(13).text('Catálogo');
  doc.moveDown(0.3);
  const produtosPorCategoria = new Map(backup.categorias.map((c) => [c.id, []]));
  backup.produtos.forEach((p) => {
    if (produtosPorCategoria.has(p.categoriaId)) produtosPorCategoria.get(p.categoriaId).push(p);
  });
  backup.categorias.forEach((cat) => {
    const produtos = produtosPorCategoria.get(cat.id) || [];
    if (doc.y > 700) doc.addPage();
    doc.fontSize(12).fillColor('#000').text(cat.nome, { underline: true });
    if (!produtos.length) {
      doc.fontSize(9).fillColor('#999').text('  (sem produtos)');
    }
    produtos.forEach((p) => {
      if (doc.y > 750) doc.addPage();
      doc.fontSize(9).fillColor('#333').text(`  ${p.nome} — ${fmtMoeda(p.preco)}${p.ativo ? '' : ' (inativo)'}`);
    });
    doc.moveDown(0.4);
  });

  doc.fillColor('#000');
  doc.moveDown(1);
  doc.fontSize(8).fillColor('#999').text(
    'Este PDF é só um relatório de leitura. Para restaurar o sistema, use o arquivo .json exportado junto com este PDF.',
  );

  doc.end();
}

module.exports = { gerarPdfCatalogo };
