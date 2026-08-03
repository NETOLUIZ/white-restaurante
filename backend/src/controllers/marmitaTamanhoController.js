/** Lista os tamanhos de marmita (pequena/grande) com preço atual — usado pela aba Marmitas do Cardápio. */
async function listarPublico(req, res) {
  try {
    const tamanhos = await req.prisma.tamanhoMarmita.findMany({ orderBy: { qtdProteinas: 'asc' } });
    res.json(tamanhos);
  } catch (err) {
    console.error('Erro ao listar tamanhos de marmita:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Atualiza preço/nome/quantidade de proteínas de um tamanho — painel admin.
 *
 * O :id da rota chega em dois formatos, dependendo de qual tela do admin
 * chamou: o editor de preço "Monte sua Marmita" (pré-existente, não pode
 * mudar) manda o slug hardcoded ('pequena'/'grande'); a seção "Empresas"
 * manda o id numérico devolvido pela própria API. Aceita os dois — nunca
 * findUnique (proibido no client escopado, ver lib/prismaTenant.js).
 */
async function atualizar(req, res) {
  try {
    const idParam = req.params.id;
    const { nome, qtdProteinas, preco, disponivelEmpresa } = req.body;
    const data = {};
    if (nome !== undefined) data.nome = String(nome).trim();
    if (qtdProteinas !== undefined) data.qtdProteinas = parseInt(qtdProteinas, 10);
    if (preco !== undefined) data.preco = Number(preco);
    if (disponivelEmpresa !== undefined) data.disponivelEmpresa = Boolean(disponivelEmpresa);

    const filtro = /^\d+$/.test(idParam) ? { id: parseInt(idParam, 10) } : { slug: idParam };
    const atual = await req.prisma.tamanhoMarmita.findFirst({ where: filtro });
    if (!atual) {
      return res.status(404).json({ erro: 'Tamanho de marmita não encontrado' });
    }

    const tamanho = await req.prisma.tamanhoMarmita.update({ where: { id: atual.id }, data });
    res.json(tamanho);
  } catch (err) {
    console.error('Erro ao atualizar tamanho de marmita:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listarPublico, atualizar };
