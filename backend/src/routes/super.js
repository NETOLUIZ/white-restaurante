const express = require('express');
const { autenticarSuperAdmin } = require('../middleware/superAuth');
const { resolverTenantAlvo } = require('../middleware/superTenantScope');
const superAuthController = require('../controllers/superAuthController');
const superTenantController = require('../controllers/superTenantController');
const superBrandingController = require('../controllers/superBrandingController');
const superFeatureController = require('../controllers/superFeatureController');
const superImpersonacaoController = require('../controllers/superImpersonacaoController');
const superBackupController = require('../controllers/superBackupController');
const categoriaController = require('../controllers/categoriaController');
const produtoController = require('../controllers/produtoController');
const { registrarAuditoria } = require('../utils/auditLogger');
const { uploadFotoBranding, uploadBackupJson, uploadFoto } = require('../utils/upload');
const { converterWebp } = require('../middleware/converterWebp');

/**
 * Rotas do painel do dono da plataforma (/api/super, só alcançável pelo
 * subdomínio "super" — ver o guard em server.js). Sem DELETE de tenant nesta
 * fase (só ativar/desativar). CRUD de conteúdo (produto/banner/categoria) é
 * quase sempre via impersonation, operando dentro do admin do próprio tenant
 * — EXCEÇÃO deliberada: /tenants/:tenantId/produtos (tela produtos.temnaarea.site,
 * cadastro rápido de produto por código de barras escolhendo o tenant na hora,
 * sem trocar de aba/sessão). Usa prismaParaTenant (mesmo isolamento de sempre),
 * cada criação fica auditada (ver registrarAuditoria abaixo).
 */
const router = express.Router();

router.post('/login', superAuthController.login);
router.post('/logout', superAuthController.logout);

router.use(autenticarSuperAdmin);

router.get('/me', superAuthController.me);
router.put('/senha', superAuthController.alterarSenha);

router.get('/tenants', superTenantController.listar);
router.post('/tenants', superTenantController.criar);
router.get('/tenants/:id', superTenantController.detalhe);
router.put('/tenants/:id', superTenantController.atualizar);
router.put('/tenants/:id/senha', superTenantController.alterarSenhaAdmin);
router.patch('/tenants/:id/status', superTenantController.ativarDesativar);
router.delete('/tenants/:id', superTenantController.deletar);

router.get('/tenants/:id/branding', superBrandingController.obter);
router.patch('/tenants/:id/branding', superBrandingController.atualizar);
router.post('/tenants/:id/branding/logo', uploadFotoBranding.single('logo'), converterWebp, superBrandingController.enviarLogo);

router.get('/tenants/:id/features', superFeatureController.listar);
router.patch('/tenants/:id/features/:chave', superFeatureController.atualizar);

router.post('/tenants/:id/impersonar', superImpersonacaoController.impersonar);
router.get('/impersonacoes', superImpersonacaoController.listarLogs);

// ---- cadastro rápido de produto cross-tenant (tela produtos.temnaarea.site) ----
router.get('/produtos/codigo-barras/:codigo', produtoController.buscarCodigoBarras);
router.get('/tenants/:tenantId/categorias', resolverTenantAlvo, categoriaController.listarPublico);
router.post('/tenants/:tenantId/produtos', resolverTenantAlvo, (req, res, next) => {
  registrarAuditoria({ acao: 'PRODUTO_CRIADO_VIA_SUPER', ator: req.superAdmin.email, tenantId: req.tenantId, detalhes: { nome: req.body.nome }, req });
  next();
}, produtoController.criar);
router.post('/tenants/:tenantId/produtos/:id/foto', resolverTenantAlvo, uploadFoto.single('foto'), converterWebp, produtoController.enviarFoto);

router.get('/backup', superBackupController.exportarJson);
router.get('/backup/pdf', superBackupController.exportarPdf);
router.post('/backup/restaurar', uploadBackupJson.single('arquivo'), superBackupController.restaurar);

module.exports = router;
