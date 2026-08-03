const express = require('express');
const { autenticarEmpresa } = require('../middleware/auth');
const { exigirFeature } = require('../middleware/exigirFeature');
const empresaAuthController = require('../controllers/empresaAuthController');
const empresaPedidoController = require('../controllers/empresaPedidoController');

/**
 * Rotas do portal da empresa (/api/empresa) — login próprio (cliente
 * corporativo, ex: construtora), escopo restrito a ver o cardápio do dia e
 * enviar pedidos em lote pros funcionários. Sem acesso a mesas, admin ou
 * qualquer outra rota fora daqui.
 */
const router = express.Router();

router.use(exigirFeature('empresa'));

router.post('/login', empresaAuthController.login);
router.post('/logout', empresaAuthController.logout);

router.use(autenticarEmpresa);

router.get('/me', empresaAuthController.me);
router.put('/senha', empresaAuthController.alterarSenha);
router.get('/cardapio', empresaPedidoController.cardapio);
router.get('/pedidos', empresaPedidoController.meusPedidosHoje);
router.post('/pedidos', empresaPedidoController.criarLote);
router.get('/funcionarios', empresaPedidoController.listarFuncionarios);
router.post('/funcionarios', empresaPedidoController.salvarFuncionario);
router.delete('/funcionarios/:id', empresaPedidoController.removerFuncionario);

module.exports = router;
