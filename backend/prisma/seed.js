/**
 * Seed do banco do Bel do Frango ATU: tenant único, categorias, produtos, cupons,
 * banner, catálogo de "Monte sua marmita" (proteínas/complementos/tamanhos) e o
 * usuário admin inicial. Idempotente (usa upsert) — pode rodar de novo sem duplicar.
 * Catálogo espelha exatamente o que já existe hoje no protótipo estático
 * (index.html / Bel do Frango.dc.html / Admin.dc.html) deste mesmo projeto.
 *
 * Multitenant (Fase 1): todo o schema é escopado por tenantId. Este seed cria
 * um único Tenant ("belfrango") e vincula todos os registros a ele — mesmos
 * dados de hoje, sem adicionar nem remover nada.
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { CHAVES_FEATURE } = require('../src/utils/tenantFeatures');
const prisma = new PrismaClient();

const TENANT = { slug: 'belfrango', nome: 'Bel do Frango', ativo: true };

const CATEGORIAS = [
  { nome: 'Galetos', ordem: 1 },
  { nome: 'Marmitas', ordem: 2 },
  { nome: 'Porções', ordem: 3 },
  { nome: 'Combos', ordem: 4 },
  { nome: 'Bebidas', ordem: 5 },
  { nome: 'Sobremesas', ordem: 6 },
];

// Subcategorias só existem hoje dentro de Bebidas (pedido explícito do usuário).
const SUBCATEGORIAS = [
  { categoriaNome: 'Bebidas', nome: 'Cervejas', ordem: 1 },
  { categoriaNome: 'Bebidas', nome: 'Água', ordem: 2 },
  { categoriaNome: 'Bebidas', nome: 'Refrigerante', ordem: 3 },
  { categoriaNome: 'Bebidas', nome: 'Água de Coco', ordem: 4 },
];

const PRODUTOS = [
  { categoriaNome: 'Galetos', nome: 'Galeto Inteiro na Brasa', descricaoCurta: 'Frango galeto temperado na brasa, suculento e dourado por fora.', preco: 49.9, avaliacao: 4.9, tag: 'Mais pedido', destaque: true, estoque: 18 },
  { categoriaNome: 'Galetos', nome: 'Meio Galeto na Brasa', descricaoCurta: 'Meia porção do nosso galeto assado lentamente.', preco: 28.9, avaliacao: 4.8, destaque: true, estoque: 22 },
  { categoriaNome: 'Galetos', nome: 'Coxa e Sobrecoxa (4 un.)', descricaoCurta: 'Quatro peças assadas no ponto, marinadas na casa.', preco: 32.9, avaliacao: 4.7, estoque: 9 },
  { categoriaNome: 'Porções', nome: 'Frango a Passarinho', descricaoCurta: 'Pedacinhos crocantes com alho e salsinha. Serve 2.', preco: 34.9, avaliacao: 4.8, tag: 'Crocante', destaque: true, estoque: 14 },
  { categoriaNome: 'Porções', nome: 'Porção Polenta Frita', descricaoCurta: 'Bastões de polenta crocantes. Serve 2.', preco: 19.9, avaliacao: 4.6, estoque: 16 },
  { categoriaNome: 'Porções', nome: 'Porção Mandioca Frita', descricaoCurta: 'Mandioca sequinha com toque de sal grosso.', preco: 18.9, avaliacao: 4.5, estoque: 4 },
  { categoriaNome: 'Porções', nome: 'Farofa da Casa', descricaoCurta: 'Farofa amanteigada com bacon e ovos.', preco: 12.9, avaliacao: 4.7, estoque: 25 },
  { categoriaNome: 'Combos', nome: 'Combo Família', descricaoCurta: 'Galeto inteiro + 2 acompanhamentos + refri 2L.', preco: 79.9, avaliacao: 4.9, tag: 'Serve 4', destaque: true, estoque: 7 },
  { categoriaNome: 'Combos', nome: 'Combo Casal', descricaoCurta: 'Meio galeto + 1 porção + 2 refris lata.', preco: 54.9, avaliacao: 4.8, tag: 'Serve 2', estoque: 11 },
  { categoriaNome: 'Bebidas', subcategoriaNome: 'Refrigerante', nome: 'Guaraná 2L', descricaoCurta: 'Refrigerante gelado para acompanhar.', preco: 12.9, estoque: 48 },
  { categoriaNome: 'Bebidas', nome: 'Suco de Laranja 500ml', descricaoCurta: 'Natural, feito na hora.', preco: 9.9, estoque: 30 },
  { categoriaNome: 'Sobremesas', nome: 'Pudim de Leite', descricaoCurta: 'Clássico cremoso com calda de caramelo.', preco: 11.9, avaliacao: 4.9, estoque: 0 },
  { categoriaNome: 'Sobremesas', nome: 'Mousse de Maracujá', descricaoCurta: 'Leve, azedinho e gelado.', preco: 10.9, avaliacao: 4.8, estoque: 20 },
];

const CUPONS = [
  { codigo: 'FRANGO10', tipo: 'PERCENTUAL', percentual: 10 },
  { codigo: 'BELDOFRANGO', tipo: 'PERCENTUAL', percentual: 10 },
  { codigo: 'FRETEGRATIS', tipo: 'FRETE_GRATIS', percentual: null },
];

// "Monte sua marmita" — mesmo catálogo padrão usado no protótipo estático (localStorage bf_marmita_config).
const PROTEINAS = ['Frango Grelhado', 'Carne Moída', 'Frango à Parmegiana', 'Linguiça Acebolada'];
const COMPLEMENTOS = ['Arroz', 'Feijão Tropeiro', 'Farofa', 'Vinagrete', 'Mandioca Frita', 'Salada'];
// slug preserva a string que o frontend (index.html) manda no checkout — nunca muda,
// mesmo com o id do TamanhoMarmita tendo virado serial (Fase 1 multitenant).
const TAMANHOS_MARMITA = [
  { slug: 'pequena', nome: 'Marmita Pequena', qtdProteinas: 1, preco: 24.9 },
  { slug: 'grande', nome: 'Marmita Grande', qtdProteinas: 2, preco: 32.9 },
];

async function main() {
  console.log('Iniciando seed do Bel do Frango ATU...');

  // Em producao, exigimos as senhas via env — nunca criar conta admin/garcom/atendente
  // com a senha padrao (publica no historico do Git) num ambiente real. Checado antes
  // de qualquer escrita no banco, nao só antes de criar as contas.
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.SEED_ADMIN_SENHA || !process.env.SEED_GARCOM_SENHA || !process.env.SEED_ATENDENTE_SENHA)
  ) {
    console.error('FATAL: SEED_ADMIN_SENHA, SEED_GARCOM_SENHA e SEED_ATENDENTE_SENHA sao obrigatorias em producao — defina-as no .env antes de rodar o seed.');
    process.exit(1);
  }
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.SEED_SUPER_EMAIL || !process.env.SEED_SUPER_SENHA)
  ) {
    console.error('FATAL: SEED_SUPER_EMAIL e SEED_SUPER_SENHA sao obrigatorias em producao — defina-as no .env antes de rodar o seed.');
    process.exit(1);
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT.slug },
    update: { nome: TENANT.nome, ativo: TENANT.ativo },
    create: TENANT,
  });
  const tenantId = tenant.id;
  console.log(`Tenant "${tenant.slug}" (${tenantId}) criado/já existente`);

  await prisma.tenantBranding.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId },
  });
  for (const chave of CHAVES_FEATURE) {
    await prisma.tenantFeature.upsert({
      where: { tenantId_chave: { tenantId, chave } },
      update: {},
      create: { tenantId, chave, ativo: true },
    });
  }
  console.log(`Branding padrão e ${CHAVES_FEATURE.length} features (${CHAVES_FEATURE.join(', ')}) criados/já existentes`);

  const categoriaIdPorNome = new Map();
  for (const categoria of CATEGORIAS) {
    const registro = await prisma.categoriaProduto.upsert({
      where: { tenantId_nome: { tenantId, nome: categoria.nome } },
      update: { ordem: categoria.ordem },
      create: { ...categoria, tenantId },
    });
    categoriaIdPorNome.set(categoria.nome, registro.id);
  }
  console.log(`${CATEGORIAS.length} categorias criadas/atualizadas`);

  const subcategoriaIdPorChave = new Map();
  for (const sub of SUBCATEGORIAS) {
    const categoriaId = categoriaIdPorNome.get(sub.categoriaNome);
    const registro = await prisma.subcategoria.upsert({
      where: { tenantId_categoriaId_nome: { tenantId, categoriaId, nome: sub.nome } },
      update: { ordem: sub.ordem },
      create: { tenantId, categoriaId, nome: sub.nome, ordem: sub.ordem },
    });
    subcategoriaIdPorChave.set(sub.categoriaNome + '|' + sub.nome, registro.id);
  }
  console.log(`${SUBCATEGORIAS.length} subcategorias criadas/atualizadas (dentro de Bebidas)`);

  for (const produto of PRODUTOS) {
    const categoriaId = categoriaIdPorNome.get(produto.categoriaNome);
    const subcategoriaId = produto.subcategoriaNome
      ? subcategoriaIdPorChave.get(produto.categoriaNome + '|' + produto.subcategoriaNome)
      : null;
    const existente = await prisma.produto.findFirst({ where: { tenantId, nome: produto.nome } });
    const dados = {
      tenantId,
      categoriaId,
      subcategoriaId,
      nome: produto.nome,
      descricaoCurta: produto.descricaoCurta,
      descricaoCompleta: produto.descricaoCurta,
      preco: produto.preco,
      avaliacao: produto.avaliacao ?? null,
      tag: produto.tag ?? null,
      destaque: Boolean(produto.destaque),
      estoque: produto.estoque ?? 0,
      ativo: produto.estoque !== 0,
    };
    if (existente) {
      await prisma.produto.update({ where: { id: existente.id }, data: dados });
    } else {
      await prisma.produto.create({ data: dados });
    }
  }
  console.log(`${PRODUTOS.length} produtos criados/atualizados`);

  for (const cupom of CUPONS) {
    await prisma.cupom.upsert({
      where: { tenantId_codigo: { tenantId, codigo: cupom.codigo } },
      update: { tipo: cupom.tipo, percentual: cupom.percentual, ativo: true },
      create: { ...cupom, tenantId },
    });
  }
  console.log(`${CUPONS.length} cupons criados/atualizados (FRANGO10, BELDOFRANGO, FRETEGRATIS)`);

  const bannerExistente = await prisma.banner.count({ where: { tenantId } });
  if (bannerExistente === 0) {
    await prisma.banner.create({
      data: {
        tenantId,
        selo: 'Promo do dia',
        titulo: 'Galeto Inteiro\ncom frete grátis',
        descricao: 'Pedidos acima de R$ 60 hoje',
        ctaLabel: 'Pedir agora',
        ctaTipo: 'CARDAPIO',
        ordem: 1,
      },
    });
    console.log('1 banner inicial criado');
  }

  const mesaExistente = await prisma.mesa.count({ where: { tenantId } });
  if (mesaExistente === 0) {
    const MESAS = [
      { numero: 1, lugares: 4 }, { numero: 2, lugares: 2 }, { numero: 3, lugares: 4 }, { numero: 4, lugares: 6 },
      { numero: 5, lugares: 2 }, { numero: 6, lugares: 4 }, { numero: 7, lugares: 4 }, { numero: 8, lugares: 8 },
      { numero: 9, lugares: 2 }, { numero: 10, lugares: 4 }, { numero: 11, lugares: 6 }, { numero: 12, lugares: 2 },
    ];
    await prisma.mesa.createMany({ data: MESAS.map((m) => ({ ...m, tenantId })) });
    console.log(`${MESAS.length} mesas do salão criadas`);
  }

  for (const nome of PROTEINAS) {
    const existente = await prisma.proteina.findFirst({ where: { tenantId, nome } });
    if (!existente) await prisma.proteina.create({ data: { tenantId, nome } });
  }
  console.log(`${PROTEINAS.length} proteínas criadas/já existentes`);

  for (const nome of COMPLEMENTOS) {
    const existente = await prisma.complemento.findFirst({ where: { tenantId, nome } });
    if (!existente) await prisma.complemento.create({ data: { tenantId, nome } });
  }
  console.log(`${COMPLEMENTOS.length} complementos criados/já existentes`);

  for (const tamanho of TAMANHOS_MARMITA) {
    await prisma.tamanhoMarmita.upsert({
      where: { tenantId_slug: { tenantId, slug: tamanho.slug } },
      update: { nome: tamanho.nome, qtdProteinas: tamanho.qtdProteinas, preco: tamanho.preco },
      create: { ...tamanho, tenantId },
    });
  }
  console.log(`${TAMANHOS_MARMITA.length} tamanhos de marmita criados/atualizados (pequena, grande)`);

  // Taxa de entrega: antes vivia fixa no .env — agora mora no banco e o admin edita pelo painel.
  // O valor do .env (se houver) só é usado pra dar o valor inicial, na primeira vez.
  await prisma.configuracao.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, taxaEntrega: Number(process.env.TAXA_ENTREGA) || 7.9 },
  });
  console.log('Configuração da loja criada/já existente (taxa de entrega)');

  const senhaAdmin = process.env.SEED_ADMIN_SENHA || 'BelDoFrangoAtu@2026';
  const senhaHash = await bcrypt.hash(senhaAdmin, 12);
  await prisma.admin.upsert({
    where: { tenantId_email: { tenantId, email: 'admin@beldofrango.com' } },
    update: {},
    create: { tenantId, email: 'admin@beldofrango.com', senha: senhaHash, nome: 'Administrador' },
  });

  const senhaGarcom = process.env.SEED_GARCOM_SENHA || 'GarcomBelDoFrango@2026';
  const senhaGarcomHash = await bcrypt.hash(senhaGarcom, 12);
  await prisma.garcom.upsert({
    where: { tenantId_email: { tenantId, email: 'garcom@beldofrango.com' } },
    update: {},
    create: { tenantId, email: 'garcom@beldofrango.com', senha: senhaGarcomHash, nome: 'Garçom' },
  });

  const senhaAtendente = process.env.SEED_ATENDENTE_SENHA || 'AtendenteBelDoFrango@2026';
  const senhaAtendenteHash = await bcrypt.hash(senhaAtendente, 12);
  await prisma.atendente.upsert({
    where: { tenantId_email: { tenantId, email: 'atendente@beldofrango.com' } },
    update: {},
    create: { tenantId, email: 'atendente@beldofrango.com', senha: senhaAtendenteHash, nome: 'Atendente' },
  });

  // Super admin não pertence a tenant nenhum — email único global (Fase 6A).
  const emailSuper = process.env.SEED_SUPER_EMAIL || 'super@beldofrango.com';
  const senhaSuper = process.env.SEED_SUPER_SENHA || 'SuperBelDoFrangoAtu@2026';
  const senhaSuperHash = await bcrypt.hash(senhaSuper, 12);
  await prisma.superAdmin.upsert({
    where: { email: emailSuper },
    update: {},
    create: { email: emailSuper, senha: senhaSuperHash, nome: 'Super Admin' },
  });

  console.log('\n✔ Seed concluído com sucesso!');
  console.log('─────────────────────────────────────────');
  console.log(`Tenant          : ${tenant.slug}`);
  console.log('Admin login     : admin@beldofrango.com');
  console.log(`Admin senha     : ${senhaAdmin}`);
  console.log('Garçom login    : garcom@beldofrango.com');
  console.log(`Garçom senha    : ${senhaGarcom}`);
  console.log('Atendente login : atendente@beldofrango.com');
  console.log(`Atendente senha : ${senhaAtendente}`);
  console.log('Super login     : ' + emailSuper);
  console.log(`Super senha     : ${senhaSuper}`);
  console.log('─────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
