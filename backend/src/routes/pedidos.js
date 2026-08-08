const express = require('express');
const { criar, buscarPorCodigo, avaliar } = require('../controllers/pedidoController');

const router = express.Router();

router.post('/', criar);
// Por código (UUID), nunca pelo id sequencial — ver comentário em buscarPorCodigo.
router.get('/:codigo', buscarPorCodigo);
router.post('/:codigo/avaliar', avaliar);

module.exports = router;
