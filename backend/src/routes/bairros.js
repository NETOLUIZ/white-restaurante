const express = require('express');
const { listarPublico } = require('../controllers/bairroController');

const router = express.Router();

router.get('/', listarPublico);

module.exports = router;
