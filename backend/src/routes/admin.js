const express = require('express');
const { autenticarAdmin } = require('../middleware/auth');
const { uploadFoto, uploadFotoBanner, uploadFotoCategoria, uploadPlanilha, uploadBackupJson } = require('../utils/upload');
const { converterWebp } = require('../middleware/converterWebp');
const backupController = require('../controllers/backupController');
const categoriaController = require('../controllers/categoriaController');
const produtoController = require('../controllers/produtoController');
const catalogoProdutoController = require('../controllers/catalogoProdutoController');
const cupomController = require('../controllers/cupomController');
const pedidoController = require('../controllers/pedidoController');
const bannerController = require('../controllers/bannerController');
const proteinaController = require('../controllers/proteinaController');
const complementoController = require('../controllers/complementoController');
const bairroController = require('../controllers/bairroController');
const adicionalController = require('../controllers/adicionalController');
const marmitaTamanhoController = require('../controllers/marmitaTamanhoController');
const entregadorController = require('../controllers/entregadorController');
const garcomAdminController = require('../controllers/garcomAdminController');
const atendenteAdminController = require('../controllers/atendenteAdminController');
const empresaAdminController = require('../controllers/empresaAdminController');
const caixaController = require('../controllers/caixaController');
const configuracaoController = require('../controllers/configuracaoController');
const whatsappController = require('../controllers/whatsappController');
const mesaController = require('../controllers/mesaController');

/**
 * Agrega todas as rotas do painel administrativo (montado em /api/admin em
 * server.js). Toda rota aqui exige sessão de admin válida (cookie httpOnly).
 */
const router = express.Router();
router.use(autenticarAdmin);

/** "Empresas" (clientes corporativos, pedido em lote) só faz sentido pra tenant tipo RESTAURANTE. */
function exigirRestaurante(req, res, next) {
  if (req.tenant.tipo !== 'RESTAURANTE') {
    return res.status(403).json({ erro: 'Recurso disponível só para tenants do tipo restaurante' });
  }
  next();
}

router.get('/categorias', categoriaController.listarPublico);
router.post('/categorias', categoriaController.criar);
router.put('/categorias/:id', categoriaController.atualizar);
router.delete('/categorias/:id', categoriaController.deletar);
router.post('/categorias/:id/foto', uploadFotoCategoria.single('foto'), converterWebp, categoriaController.enviarFoto);
router.delete('/categorias/:id/foto', categoriaController.removerFoto);

router.get('/produtos', produtoController.listarAdmin);
router.get('/produtos/codigo-barras/:codigo', produtoController.buscarCodigoBarras);
router.post('/produtos/:id/foto-url', produtoController.importarFotoUrl);
router.get('/produtos/import/modelo', produtoController.baixarModeloImportacao);
router.post('/produtos/import', uploadPlanilha.single('arquivo'), produtoController.importarProdutos);
router.post('/produtos', produtoController.criar);
router.put('/produtos/:id', produtoController.atualizar);
router.delete('/produtos/:id', produtoController.deletar);
router.post('/produtos/:id/foto', uploadFoto.single('foto'), converterWebp, produtoController.enviarFoto);
router.delete('/produtos/:id/foto', produtoController.removerFoto);
router.put('/produtos/:id/estoque', produtoController.ajustarEstoque);
router.get('/catalogo', catalogoProdutoController.listar);
router.post('/catalogo/:catalogoProdutoId/importar', catalogoProdutoController.importar);
router.post('/produtos/:produtoId/adicionais', adicionalController.criar);

router.get('/cupons', cupomController.listarAdmin);
router.post('/cupons', cupomController.criar);
router.put('/cupons/:id', cupomController.atualizar);

router.get('/pedidos/relatorio-dia', pedidoController.relatorioDia);
router.get('/pedidos', pedidoController.listarAdmin);
router.put('/pedidos/:id/status', pedidoController.atualizarStatus);

router.get('/banners', bannerController.listarAdmin);
router.post('/banners', bannerController.criar);
router.put('/banners/:id', bannerController.atualizar);
router.delete('/banners/:id', bannerController.deletar);
router.post('/banners/:id/foto', uploadFotoBanner.single('foto'), converterWebp, bannerController.enviarFoto);
router.delete('/banners/:id/foto', bannerController.removerFoto);

router.get('/proteinas', proteinaController.listarAdmin);
router.post('/proteinas', proteinaController.criar);
router.put('/proteinas/:id', proteinaController.atualizar);
router.delete('/proteinas/:id', proteinaController.deletar);

router.get('/complementos', complementoController.listarAdmin);
router.post('/complementos', complementoController.criar);
router.put('/complementos/:id', complementoController.atualizar);
router.delete('/complementos/:id', complementoController.deletar);

router.get('/bairros', bairroController.listarAdmin);
router.post('/bairros', bairroController.criar);
router.put('/bairros/:id', bairroController.atualizar);
router.delete('/bairros/:id', bairroController.deletar);

router.put('/marmita-tamanhos/:id', marmitaTamanhoController.atualizar);

router.put('/adicionais/:id', adicionalController.atualizar);
router.delete('/adicionais/:id', adicionalController.deletar);

router.get('/entregadores', entregadorController.listarAdmin);
router.post('/entregadores', entregadorController.criar);
router.put('/entregadores/:id', entregadorController.atualizar);
router.get('/entregadores/saldos', entregadorController.listarSaldos);
router.post('/entregadores/:id/sangria', entregadorController.registrarSangria);
router.post('/entregadores/:id/zerar-saldo', entregadorController.zerarSaldo);

router.get('/garcons', garcomAdminController.listarAdmin);
router.post('/garcons', garcomAdminController.criar);
router.put('/garcons/:id', garcomAdminController.atualizar);

router.get('/atendentes', atendenteAdminController.listarAdmin);
router.post('/atendentes', atendenteAdminController.criar);
router.put('/atendentes/:id', atendenteAdminController.atualizar);

router.get('/empresas', exigirRestaurante, empresaAdminController.listarAdmin);
router.post('/empresas', exigirRestaurante, empresaAdminController.criar);
router.put('/empresas/:id', exigirRestaurante, empresaAdminController.atualizar);
router.post('/empresas/:id/pedidos', exigirRestaurante, empresaAdminController.criarPedidoAdmin);
router.delete('/empresas/:id/funcionarios/:funcId', exigirRestaurante, empresaAdminController.removerFuncionario);

const { atribuirEntregador } = require('../controllers/pedidoController');
router.put('/pedidos/:id/entregador', atribuirEntregador);

router.get('/caixa', caixaController.status);
router.post('/caixa/abrir', caixaController.abrir);
router.post('/caixa/fechar', caixaController.fechar);

router.get('/configuracao', configuracaoController.obter);
router.put('/configuracao', configuracaoController.atualizar);
router.post('/whatsapp/conectar', whatsappController.conectar);
router.get('/whatsapp/status', whatsappController.status);
router.post('/whatsapp/desconectar', whatsappController.desconectar);

router.get('/mesas', mesaController.listarAdmin);
router.post('/mesas', mesaController.criar);
router.put('/mesas/:id/nome', mesaController.definirNome);
router.put('/mesas/:id/status', mesaController.mudarStatus);
router.post('/mesas/:id/itens', mesaController.adicionarItem);
router.put('/mesas/:id/itens/:itemId', mesaController.ajustarItem);
router.post('/mesas/:id/fechar', mesaController.fecharConta);

router.get('/backup', backupController.exportarJson);
router.get('/backup/pdf', backupController.exportarPdf);
router.post('/backup/restaurar', uploadBackupJson.single('arquivo'), backupController.restaurar);

module.exports = router;
