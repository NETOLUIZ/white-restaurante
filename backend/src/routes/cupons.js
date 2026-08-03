const express = require('express');
const { validar } = require('../controllers/cupomController');
const { exigirFeature } = require('../middleware/exigirFeature');

const router = express.Router();

router.use(exigirFeature('cupom'));

router.post('/validar', validar);

module.exports = router;
