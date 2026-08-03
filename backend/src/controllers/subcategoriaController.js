/** Lista as subcategorias, ordenadas — usado pelo Cardápio e pelo formulário de produto do Admin. */
async function listarPublico(req, res) {
  try {
    const subcategorias = await req.prisma.subcategoria.findMany({
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
    res.json(subcategorias);
  } catch (err) {
    console.error('Erro ao listar subcategorias:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listarPublico };
