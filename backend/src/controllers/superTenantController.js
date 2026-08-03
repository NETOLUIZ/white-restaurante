const bcrypt = require('bcryptjs');
const { prismaBase } = require('../lib/prismaBase');
const { validarSlug } = require('../utils/slugTenant');
const { CHAVES_FEATURE } = require('../utils/tenantFeatures');
const { invalidarCacheTenant } = require('../middleware/resolveTenant');
const { registrarAuditoria } = require('../utils/auditLogger');

/**
 * Super admin não reimplementa CRUD de conteúdo — só gerencia o tenant como
 * unidade (criar, listar, ativar/desativar, editar nome). Conteúdo (produto,
 * banner, categoria) é sempre via impersonation, operando dentro do admin
 * do próprio tenant. Por isso os controllers aqui usam prismaBase direto —
 * são o único lugar do sistema autorizado a isso (ver lib/prismaTenant.js).
 */

/** Lista todos os tenants com contagem de produtos e pedidos — visão geral do super admin. */
async function listar(req, res) {
  try {
    const tenants = await prismaBase.tenant.findMany({
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        slug: true,
        nome: true,
        tipo: true,
        ativo: true,
        criadoEm: true,
        _count: { select: { produtos: true, pedidos: true } },
      },
    });
    res.json(
      tenants.map((t) => ({
        id: t.id,
        slug: t.slug,
        nome: t.nome,
        tipo: t.tipo,
        ativo: t.ativo,
        criadoEm: t.criadoEm,
        totalProdutos: t._count.produtos,
        totalPedidos: t._count.pedidos,
      })),
    );
  } catch (err) {
    console.error('Erro ao listar tenants:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Cria um tenant novo — transacional. Cria Tenant + TenantBranding padrão +
 * as 5 TenantFeature ativas + Configuracao padrão + os 2 TamanhoMarmita +
 * o Admin inicial. Se qualquer passo falhar, nada fica gravado (sem tenant
 * pela metade). Mesmo provisionamento de scripts/criar-tenant.js.
 */
async function criar(req, res) {
  try {
    const { slug, nome, adminEmail, adminSenha, tipo: tipoRaw } = req.body;

    try {
      validarSlug(slug);
    } catch (err) {
      return res.status(400).json({ erro: err.message });
    }
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'Nome é obrigatório' });
    }
    if (!adminEmail || !String(adminEmail).includes('@')) {
      return res.status(400).json({ erro: 'Email do admin inicial inválido' });
    }
    if (!adminSenha || String(adminSenha).length < 6) {
      return res.status(400).json({ erro: 'Senha do admin inicial precisa de ao menos 6 caracteres' });
    }
    const tipo = String(tipoRaw || 'RESTAURANTE').trim().toUpperCase();
    if (tipo !== 'RESTAURANTE' && tipo !== 'MERCANTIL') {
      return res.status(400).json({ erro: 'tipo precisa ser "RESTAURANTE" ou "MERCANTIL"' });
    }

    const senhaHash = await bcrypt.hash(String(adminSenha), 12);

    const resultado = await prismaBase.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { slug: String(slug).trim().toLowerCase(), nome: String(nome).trim(), tipo } });

      await tx.tenantBranding.create({ data: { tenantId: tenant.id } });

      // "marmita" é feature de restaurante — cria desligada pra mercantil (o super
      // admin ainda pode ligar manualmente depois na aba Features, se fizer sentido).
      await tx.tenantFeature.createMany({
        data: CHAVES_FEATURE.map((chave) => ({ tenantId: tenant.id, chave, ativo: chave === 'marmita' ? tipo === 'RESTAURANTE' : true })),
      });

      await tx.configuracao.create({ data: { tenantId: tenant.id } });

      // Marmita é conceito de restaurante — mercantil não vende marmita por tamanho.
      if (tipo === 'RESTAURANTE') {
        await tx.tamanhoMarmita.createMany({
          data: [
            { tenantId: tenant.id, slug: 'pequena', nome: 'Marmita Pequena', qtdProteinas: 1, preco: 24.9 },
            { tenantId: tenant.id, slug: 'grande', nome: 'Marmita Grande', qtdProteinas: 2, preco: 32.9 },
          ],
        });
      }

      const admin = await tx.admin.create({
        data: { tenantId: tenant.id, email: String(adminEmail).trim().toLowerCase(), senha: senhaHash, nome: 'Administrador' },
      });

      return { tenant, admin };
    });

    res.status(201).json({
      tenant: { id: resultado.tenant.id, slug: resultado.tenant.slug, nome: resultado.tenant.nome, tipo: resultado.tenant.tipo, ativo: resultado.tenant.ativo },
      admin: { id: resultado.admin.id, email: resultado.admin.email },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ erro: 'Já existe um tenant com esse slug' });
    }
    console.error('Erro ao criar tenant:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Detalhe de um tenant — mesmas contagens da listagem, pra tela de detalhe do super admin. */
async function detalhe(req, res) {
  try {
    const { id } = req.params;
    const tenant = await prismaBase.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        nome: true,
        tipo: true,
        ativo: true,
        criadoEm: true,
        _count: { select: { produtos: true, pedidos: true } },
      },
    });
    if (!tenant) {
      return res.status(404).json({ erro: 'Tenant não encontrado' });
    }
    res.json({
      id: tenant.id,
      slug: tenant.slug,
      nome: tenant.nome,
      tipo: tenant.tipo,
      ativo: tenant.ativo,
      criadoEm: tenant.criadoEm,
      totalProdutos: tenant._count.produtos,
      totalPedidos: tenant._count.pedidos,
    });
  } catch (err) {
    console.error('Erro ao buscar tenant:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/** Edita o nome de um tenant — painel do super admin. O slug nunca muda depois de criado. */
async function atualizar(req, res) {
  try {
    const { id } = req.params;
    const { nome } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'Nome é obrigatório' });
    }
    const tenant = await prismaBase.tenant.update({ where: { id }, data: { nome: String(nome).trim() } });
    res.json({ id: tenant.id, slug: tenant.slug, nome: tenant.nome, ativo: tenant.ativo });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ erro: 'Tenant não encontrado' });
    }
    console.error('Erro ao atualizar tenant:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

/**
 * Ativa/desativa um tenant — nunca deleta (sem DELETE nesta fase). Desativar
 * faz resolveTenant devolver 404 pro subdomínio inteiro. Invalida o cache de
 * resolução na hora — sem isso, o tenant desativado continuaria respondendo
 * por até 60s (TTL do cache de resolveTenant).
 */
async function ativarDesativar(req, res) {
  try {
    const { id } = req.params;
    const { ativo } = req.body;
    if (typeof ativo !== 'boolean') {
      return res.status(400).json({ erro: 'Campo "ativo" precisa ser true ou false' });
    }
    const tenant = await prismaBase.tenant.update({ where: { id }, data: { ativo } });
    invalidarCacheTenant(tenant.slug);
    registrarAuditoria({ acao: 'TENANT_STATUS_ALTERADO', ator: req.superAdmin?.email, tenantId: tenant.id, detalhes: { slug: tenant.slug, ativo }, req });
    res.json({ id: tenant.id, slug: tenant.slug, nome: tenant.nome, ativo: tenant.ativo });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ erro: 'Tenant não encontrado' });
    }
    console.error('Erro ao ativar/desativar tenant:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

async function deletar(req, res) {
  try {
    const { id } = req.params;
    const { confirmarSlug } = req.body;

    const tenant = await prismaBase.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ erro: 'Tenant não encontrado' });
    }
    if (confirmarSlug !== tenant.slug) {
      return res.status(400).json({ erro: 'Confirmação não bate com o slug do tenant' });
    }

    await prismaBase.tenant.delete({ where: { id } });
    invalidarCacheTenant(tenant.slug);
    registrarAuditoria({ acao: 'TENANT_EXCLUIDO', ator: req.superAdmin?.email, tenantId: tenant.id, detalhes: { slug: tenant.slug, nome: tenant.nome }, req });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ erro: 'Tenant não encontrado' });
    }
    console.error('Erro ao excluir tenant:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

async function alterarSenhaAdmin(req, res) {
  try {
    const { id } = req.params;
    const { novaSenha } = req.body;
    if (!novaSenha || String(novaSenha).length < 6) {
      return res.status(400).json({ erro: 'A nova senha precisa ter no mínimo 6 caracteres' });
    }
    const tenant = await prismaBase.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ erro: 'Tenant não encontrado' });
    }
    const senhaHash = await bcrypt.hash(String(novaSenha), 12);
    await prismaBase.admin.updateMany({
      where: { tenantId: id },
      data: { senha: senhaHash },
    });
    registrarAuditoria({ acao: 'ADMIN_SENHA_ALTERADA_PELO_SUPER', ator: req.superAdmin?.email, tenantId: tenant.id, detalhes: { slug: tenant.slug }, req });
    res.json({ ok: true, mensagem: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error('Erro ao alterar senha do admin do tenant:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { listar, criar, detalhe, atualizar, ativarDesativar, deletar, alterarSenhaAdmin };
