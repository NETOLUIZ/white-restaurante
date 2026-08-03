/**
 * Verifica o isolamento entre tenants da Fase 2 (prismaTenant.js). Roda
 * inteiramente com prismaBase (client cru) pra montar o cenário, e testa o
 * client escopado (prismaParaTenant) contra ele. Idempotente-ish: cria um
 * tenant de teste próprio e remove tudo ao final, mesmo se algum assert falhar.
 */
const { prismaBase } = require('../src/lib/prismaBase');
const { prismaParaTenant } = require('../src/lib/prismaTenant');

const SLUG_TESTE = 'tenant-teste';

async function main() {
  console.log('Iniciando verificação de isolamento entre tenants...\n');

  const belfrango = await prismaBase.tenant.findUnique({ where: { slug: 'belfrango' } });
  if (!belfrango) {
    throw new Error('Tenant "belfrango" não encontrado — rode "npm run db:seed" antes.');
  }

  // limpa um resíduo de execução anterior que tenha falhado no meio
  const residuo = await prismaBase.tenant.findUnique({ where: { slug: SLUG_TESTE } });
  if (residuo) {
    await prismaBase.produto.deleteMany({ where: { tenantId: residuo.id } });
    await prismaBase.tenant.delete({ where: { id: residuo.id } });
  }

  let tenantTeste;
  let falhas = 0;

  try {
    // 1. segundo tenant + 1 produto vinculado a ele
    tenantTeste = await prismaBase.tenant.create({
      data: { slug: SLUG_TESTE, nome: 'Tenant de Teste (isolamento)' },
    });
    console.log(`1. Tenant "${SLUG_TESTE}" criado (${tenantTeste.id})`);

    const categoriaTeste = await prismaBase.categoriaProduto.create({
      data: { tenantId: tenantTeste.id, nome: 'Categoria teste isolamento' },
    });
    const produtoTeste = await prismaBase.produto.create({
      data: {
        tenantId: tenantTeste.id,
        categoriaId: categoriaTeste.id,
        nome: 'PRODUTO SÓ DO TENANT-TESTE',
        descricaoCurta: 'não deveria aparecer pro belfrango',
        descricaoCompleta: 'não deveria aparecer pro belfrango',
        preco: 1,
      },
    });
    console.log(`2. Produto "${produtoTeste.nome}" criado só no tenant-teste\n`);

    // 3. client escopado ao belfrango
    const prismaBelfrango = prismaParaTenant(belfrango.id);

    // 4/5. findMany sem where nenhum não pode vazar o produto do outro tenant
    const produtosDoBelfrango = await prismaBelfrango.produto.findMany();
    const vazou = produtosDoBelfrango.some((p) => p.id === produtoTeste.id);
    if (vazou) {
      console.error('❌ FALHA: produto.findMany() do belfrango retornou o produto do tenant-teste — vazamento de isolamento!');
      falhas++;
    } else {
      console.log(`✔ produto.findMany() escopado ao belfrango: ${produtosDoBelfrango.length} produto(s), nenhum do tenant-teste`);
    }

    // 6. create sem tenantId explícito precisa nascer com o tenantId certo
    const categoriaBelfrango = await prismaBelfrango.categoriaProduto.findFirst();
    const criado = await prismaBelfrango.produto.create({
      data: {
        categoriaId: categoriaBelfrango.id,
        nome: 'PRODUTO CRIADO VIA CLIENT ESCOPADO (verificação)',
        descricaoCurta: 'teste',
        descricaoCompleta: 'teste',
        preco: 1,
      },
    });
    if (criado.tenantId === belfrango.id) {
      console.log(`✔ produto.create() sem tenantId explícito nasceu com tenantId=${criado.tenantId} (belfrango) — correto`);
    } else {
      console.error(`❌ FALHA: produto criado com tenantId=${criado.tenantId}, esperado ${belfrango.id}`);
      falhas++;
    }
    await prismaBase.produto.delete({ where: { id: criado.id } });

    // 7. findUnique precisa ser bloqueado pela extension
    let bloqueouFindUnique = false;
    try {
      await prismaBelfrango.admin.findUnique({ where: { email: 'admin@beldofrango.com' } });
    } catch (err) {
      bloqueouFindUnique = /não é permitido/.test(err.message);
    }
    if (bloqueouFindUnique) {
      console.log('✔ admin.findUnique() lançou erro como esperado (findUnique é proibido no client escopado)');
    } else {
      console.error('❌ FALHA: admin.findUnique() não lançou erro — deveria ser bloqueado pela extension');
      falhas++;
    }
  } finally {
    // 8. limpeza do tenant de teste, mesmo se algum assert falhou acima
    if (tenantTeste) {
      await prismaBase.produto.deleteMany({ where: { tenantId: tenantTeste.id } });
      await prismaBase.categoriaProduto.deleteMany({ where: { tenantId: tenantTeste.id } });
      await prismaBase.tenant.delete({ where: { id: tenantTeste.id } });
      console.log(`\n8. Tenant "${SLUG_TESTE}" e seus dados removidos`);
    }
  }

  console.log('\n' + (falhas === 0 ? '✔ Todos os asserts de isolamento passaram.' : `❌ ${falhas} assert(s) falharam.`));
  await prismaBase.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Erro ao rodar verificação de isolamento:', err);
  await prismaBase.$disconnect();
  process.exit(1);
});
