const express = require('express');
const { autenticarAtendente } = require('../middleware/auth');
const atendenteAuthController = require('../controllers/atendenteAuthController');
const pedidoController = require('../controllers/pedidoController');

/**
 * Rotas da tela do atendente (/api/atendente) — login próprio, escopo restrito
 * a criar pedido manual de balcão (retirada). Sem acesso a mesas, admin ou
 * qualquer outra rota fora daqui. O catálogo (categorias/produtos) é lido
 * dos endpoints públicos já existentes (/api/categorias, /api/produtos).
 */
const router = express.Router();

router.post('/login', atendenteAuthController.login);
router.post('/logout', atendenteAuthController.logout);

router.use(autenticarAtendente);

router.get('/me', atendenteAuthController.me);
router.put('/senha', atendenteAuthController.alterarSenha);
router.post('/pedidos', pedidoController.criarComoAtendente);

module.exports = router;
