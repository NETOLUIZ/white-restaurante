const express = require('express');
const pagamentoController = require('../controllers/pagamentoController');

/** Rotas públicas de pagamento (webhook de provedor externo — sem sessão). */
const router = express.Router();

router.post('/mercadopago/webhook', pagamentoController.webhookMercadoPago);

module.exports = router;
