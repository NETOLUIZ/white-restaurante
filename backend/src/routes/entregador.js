const express = require('express');
const { autenticarEntregador } = require('../middleware/auth');
const { exigirFeature } = require('../middleware/exigirFeature');
const entregadorAuthController = require('../controllers/entregadorAuthController');
const entregadorController = require('../controllers/entregadorController');

/**
 * Rotas da tela do entregador (/api/entregador) — login próprio, escopo
 * restrito às entregas atribuídas a ele. Sem acesso a /api/admin/* nem /api/garcom/*.
 */
const router = express.Router();

router.use(exigirFeature('entregador'));

router.post('/login', entregadorAuthController.login);
router.post('/logout', entregadorAuthController.logout);

router.use(autenticarEntregador);

router.get('/me', entregadorAuthController.me);
router.put('/senha', entregadorAuthController.alterarSenha);
router.get('/pedidos', entregadorController.meusPedidos);
router.get('/saldo', entregadorController.meuSaldo);

module.exports = router;
