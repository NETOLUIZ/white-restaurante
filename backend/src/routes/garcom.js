const express = require('express');
const { autenticarGarcom } = require('../middleware/auth');
const { exigirFeature } = require('../middleware/exigirFeature');
const garcomAuthController = require('../controllers/garcomAuthController');
const mesaController = require('../controllers/mesaController');

/**
 * Rotas da tela do garçom (/api/garcom) — login próprio, escopo restrito a
 * mesas e comanda. Reaproveita o mesaController (mesma lógica usada pelo
 * admin), só que sob autenticarGarcom em vez de autenticarAdmin. Sem acesso
 * a criar mesa, fechar conta ou qualquer rota /api/admin/* — isso fica só
 * com o admin/caixa.
 */
const router = express.Router();

router.use(exigirFeature('mesas'));

router.post('/login', garcomAuthController.login);
router.post('/logout', garcomAuthController.logout);

router.use(autenticarGarcom);

router.get('/me', garcomAuthController.me);
router.put('/senha', garcomAuthController.alterarSenha);
router.get('/mesas', mesaController.listarAdmin);
router.put('/mesas/:id/status', mesaController.mudarStatus);
router.put('/mesas/:id/nome', mesaController.definirNome);
router.post('/mesas/:id/itens', mesaController.adicionarItem);
router.put('/mesas/:id/itens/:itemId', mesaController.ajustarItem);

module.exports = router;
