const VERSAO_BACKUP = 1;

// Ordem de restauração respeita dependência: quem tem `refs` só pode ser
// processado depois que a entidade referenciada já rodou (usa o mapa
// id-antigo -> id-novo dela).
//
// `chaveUnica`: quando a entidade tem uma constraint @@unique natural,
// restaurar faz upsert por ela — nunca apaga nada primeiro. Isso é proposital:
// produto/proteína/complemento/adicional podem estar referenciados por um
// ItemPedido de um pedido antigo (ver schema.prisma — essas FKs não têm
// onDelete: Cascade/SetNull), então um delete+recria quebraria a restauração
// em qualquer loja que já tenha pedido de verdade. Sem chaveUnica (produto,
// adicional, banner, proteína, complemento — não têm campo único no schema
// além do id), a entidade é sempre criada nova; restaurar o mesmo backup mais
// de uma vez pode duplicar esses itens especificamente.
const ENTIDADES = [
  { chave: 'categorias', model: 'categoriaProduto', chaveUnica: (r, tenantId) => ({ tenantId_nome: { tenantId, nome: r.nome } }) },
  {
    chave: 'subcategorias', model: 'subcategoria', refs: { categoriaId: 'categorias' },
    chaveUnica: (r, tenantId) => ({ tenantId_categoriaId_nome: { tenantId, categoriaId: r.categoriaId, nome: r.nome } }),
  },
  { chave: 'produtos', model: 'produto', refs: { categoriaId: 'categorias', subcategoriaId: 'subcategorias' } },
  { chave: 'adicionais', model: 'adicional', refs: { produtoId: 'produtos' } },
  { chave: 'banners', model: 'banner', refs: { produtoId: 'produtos' } },
  { chave: 'proteinas', model: 'proteina' },
  { chave: 'complementos', model: 'complemento' },
  { chave: 'tamanhosMarmita', model: 'tamanhoMarmita', chaveUnica: (r, tenantId) => ({ tenantId_slug: { tenantId, slug: r.slug } }) },
  { chave: 'cupons', model: 'cupom', chaveUnica: (r, tenantId) => ({ tenantId_codigo: { tenantId, codigo: r.codigo } }) },
  { chave: 'mesas', model: 'mesa', chaveUnica: (r, tenantId) => ({ tenantId_numero: { tenantId, numero: r.numero } }) },
  { chave: 'bairros', model: 'bairro', chaveUnica: (r, tenantId) => ({ tenantId_nome: { tenantId, nome: r.nome } }) },
  { chave: 'empresas', model: 'empresa', chaveUnica: (r, tenantId) => ({ tenantId_login: { tenantId, login: r.login } }) },
  {
    chave: 'empresaFuncionarios', model: 'empresaFuncionario', refs: { empresaId: 'empresas' },
    chaveUnica: (r) => ({ empresaId_nome: { empresaId: r.empresaId, nome: r.nome } }),
  },
  { chave: 'admins', model: 'admin', chaveUnica: (r, tenantId) => ({ tenantId_email: { tenantId, email: r.email } }) },
  { chave: 'garcons', model: 'garcom', chaveUnica: (r, tenantId) => ({ tenantId_email: { tenantId, email: r.email } }) },
  { chave: 'atendentes', model: 'atendente', chaveUnica: (r, tenantId) => ({ tenantId_email: { tenantId, email: r.email } }) },
  { chave: 'entregadores', model: 'entregador', chaveUnica: (r, tenantId) => ({ tenantId_email: { tenantId, email: r.email } }) },
];

const CAMPOS_REMOVER_NO_EXPORT = new Set(['tenantId', 'createdAt', 'updatedAt']);

function limparRegistro(registro) {
  const limpo = {};
  for (const [k, v] of Object.entries(registro)) {
    if (!CAMPOS_REMOVER_NO_EXPORT.has(k)) limpo[k] = v;
  }
  return limpo;
}

/**
 * Monta o backup de um tenant — cobre catálogo, configuração, marca e contas
 * de acesso (senha vai como hash bcrypt, igual já vive no banco — nunca texto
 * puro; é o mesmo padrão de qualquer dump de banco de verdade). NÃO inclui
 * pedidos/itens/clientes/caixa/sangria: é histórico operacional (o que
 * aconteceu), não "como a loja está configurada" (o que este backup
 * restaura). `prisma` já é o client escopado por tenant (req.prisma) — cada
 * findMany sai filtrado sem precisar passar tenantId à mão.
 */
async function montarBackupTenant(prisma, tenant) {
  const valores = await Promise.all(ENTIDADES.map((ent) => prisma[ent.model].findMany()));
  const [configuracao, branding, features] = await Promise.all([
    prisma.configuracao.findFirst(),
    prisma.tenantBranding.findFirst(),
    prisma.tenantFeature.findMany(),
  ]);

  const backup = {
    versao: VERSAO_BACKUP,
    exportadoEm: new Date().toISOString(),
    tenant: { slug: tenant.slug, nome: tenant.nome, tipo: tenant.tipo },
    configuracao: configuracao ? limparRegistro(configuracao) : null,
    branding: branding ? limparRegistro(branding) : null,
    features: features.map(limparRegistro),
  };
  ENTIDADES.forEach((ent, i) => { backup[ent.chave] = valores[i].map(limparRegistro); });
  return backup;
}

/**
 * Restaura os dados de um tenant a partir de um backup — SEMPRE aditivo,
 * nunca apaga nada antes (ver comentário de ENTIDADES sobre por quê). Itens
 * com constraint única natural são upsert (atualiza se já existe, cria se
 * não); os demais são sempre criados.
 *
 * `tx` tanto pode ser o client de transação já escopado por tenant
 * (req.prisma.$transaction, restauração por loja no Admin) quanto o client
 * cru (prismaBase.$transaction, restauração da plataforma inteira no Super
 * Admin — que precisa gravar em VÁRIOS tenants na mesma transação, e a
 * extensão de escopo só sabe atender um tenantId por vez). Por isso `tenantId`
 * é sempre setado explicitamente no registro aqui, em vez de confiar só na
 * extensão: redundante (e inofensivo) quando `tx` já é escopado, obrigatório
 * quando não é.
 */
async function restaurarBackupTenant(tx, dados, tenantId) {
  if (!dados || dados.versao !== VERSAO_BACKUP) {
    throw new Error('Arquivo de backup inválido ou de versão incompatível');
  }

  const mapas = {}; // chave da entidade -> Map(idAntigo -> idNovo)

  for (const ent of ENTIDADES) {
    const registros = dados[ent.chave] || [];
    const mapaAtual = new Map();
    for (const registroOriginal of registros) {
      const registro = { ...registroOriginal, tenantId };
      const idAntigo = registro.id;
      delete registro.id;
      if (ent.refs) {
        for (const [campo, entidadeRef] of Object.entries(ent.refs)) {
          const valorAntigo = registro[campo];
          registro[campo] = valorAntigo != null ? (mapas[entidadeRef]?.get(valorAntigo) ?? null) : null;
        }
      }
      const salvo = ent.chaveUnica
        ? await tx[ent.model].upsert({ where: ent.chaveUnica(registro, tenantId), update: registro, create: registro })
        : await tx[ent.model].create({ data: registro });
      if (idAntigo != null) mapaAtual.set(idAntigo, salvo.id);
    }
    mapas[ent.chave] = mapaAtual;
  }

  if (dados.configuracao) {
    const { id, ...resto } = dados.configuracao;
    await tx.configuracao.upsert({ where: { tenantId }, update: resto, create: { ...resto, tenantId } });
  }
  if (dados.branding) {
    const { id, ...resto } = dados.branding;
    await tx.tenantBranding.upsert({ where: { tenantId }, update: resto, create: { ...resto, tenantId } });
  }
  for (const feature of dados.features || []) {
    const { id, ...resto } = feature;
    await tx.tenantFeature.upsert({
      where: { tenantId_chave: { tenantId, chave: feature.chave } },
      update: resto,
      create: { ...resto, tenantId },
    });
  }
}

module.exports = { VERSAO_BACKUP, ENTIDADES, montarBackupTenant, restaurarBackupTenant, limparRegistro };
