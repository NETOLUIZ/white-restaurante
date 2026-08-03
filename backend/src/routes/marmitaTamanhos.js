const express = require('express');
const { listarPublico } = require('../controllers/marmitaTamanhoController');

const router = express.Router();

// Fase 6B: sem exigirFeature aqui de propósito — index.html busca essa rota
// incondicionalmente no boot (carregarMarmitaConfig, dentro do Promise.all de
// carregarTudo), então um 403 aqui derrubaria o carregamento inteiro da
// página, não só a aba de marmita. A feature "marmita" já esconde a seção
// visualmente (data-feature="marmita" em index.html); não há endpoint
// separado de pedido de marmita pra proteger (marmita usa o mesmo
// POST /pedidos genérico), então esconder é a proteção real disponível aqui.
router.get('/', listarPublico);

module.exports = router;
