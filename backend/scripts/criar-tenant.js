/**
 * Sobe um tenant novo do zero: Tenant + TenantBranding padrão + as 5
 * TenantFeature ativas + Configuracao padrão + o primeiro Admin — e, só pra
 * tipo=restaurante (default), os 2 TamanhoMarmita (pequena/grande), que não
 * fazem sentido pra um mercantil. Tudo numa única transação — se qualquer
 * passo falhar, nada fica gravado (sem tenant pela metade, sem admin
 * órfão). Mesmos passos que POST /api/super/tenants — este script é o
 * caminho de linha de comando pro mesmo provisionamento.
 *
 * Uso:
 *   node scripts/criar-tenant.js --slug=novaloja --nome="Nova Loja" \
 *     --adminEmail=admin@novaloja.com --adminSenha=SenhaForte123 [--tipo=mercantil]
 *
 * --tipo aceita "restaurante" (default) ou "mercantil".
 */
const bcrypt = require('bcryptjs');
const { prismaBase } = require('../src/lib/prismaBase');
const { validarSlug } = require('../src/utils/slugTenant');
const { CHAVES_FEATURE } = require('../src/utils/tenantFeatures');

function lerArgs() {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

async function main() {
  const { slug, nome, adminEmail, adminSenha, tipo: tipoRaw } = lerArgs();

  validarSlug(slug);
  if (!nome || !nome.trim()) throw new Error('--nome é obrigatório');
  if (!adminEmail || !adminEmail.includes('@')) throw new Error('--adminEmail inválido');
  if (!adminSenha || adminSenha.length < 6) throw new Error('--adminSenha precisa de ao menos 6 caracteres');

  const tipo = (tipoRaw || 'restaurante').trim().toUpperCase();
  if (tipo !== 'RESTAURANTE' && tipo !== 'MERCANTIL') {
    throw new Error('--tipo precisa ser "restaurante" ou "mercantil"');
  }

  const senhaHash = await bcrypt.hash(adminSenha, 12);

  const resultado = await prismaBase.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { slug, nome: nome.trim(), tipo } });

    await tx.tenantBranding.create({ data: { tenantId: tenant.id } });

    // "marmita" é feature de restaurante — cria desligada pra mercantil (o super
    // admin ainda pode ligar manualmente depois na aba Features, se fizer sentido).
    await tx.tenantFeature.createMany({
      data: CHAVES_FEATURE.map((chave) => ({ tenantId: tenant.id, chave, ativo: chave === 'marmita' ? tipo === 'RESTAURANTE' : true })),
    });

    await tx.configuracao.create({ data: { tenantId: tenant.id } });

    if (tipo === 'RESTAURANTE') {
      await tx.tamanhoMarmita.createMany({
        data: [
          { tenantId: tenant.id, slug: 'pequena', nome: 'Marmita Pequena', qtdProteinas: 1, preco: 24.9 },
          { tenantId: tenant.id, slug: 'grande', nome: 'Marmita Grande', qtdProteinas: 2, preco: 32.9 },
        ],
      });
    }

    const admin = await tx.admin.create({
      data: { tenantId: tenant.id, email: adminEmail.trim().toLowerCase(), senha: senhaHash, nome: 'Administrador' },
    });

    return { tenant, admin };
  });

  console.log('\n✔ Tenant criado com sucesso!');
  console.log('─────────────────────────────────────────');
  console.log(`Slug         : ${resultado.tenant.slug}`);
  console.log(`Tipo         : ${resultado.tenant.tipo}`);
  console.log(`Tenant id    : ${resultado.tenant.id}`);
  console.log(`Admin login  : ${resultado.admin.email}`);
  console.log('─────────────────────────────────────────');
}

main()
  .catch((err) => {
    console.error('Erro ao criar tenant:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
