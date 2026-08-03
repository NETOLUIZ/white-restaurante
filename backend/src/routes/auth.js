const express = require('express');
const { login, logout, me, alterarSenha } = require('../controllers/authController');
const { impersonar, encerrarImpersonacao } = require('../controllers/impersonacaoController');
const { autenticarAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', autenticarAdmin, me);
router.put('/senha', autenticarAdmin, alterarSenha);

router.post('/impersonar', impersonar);
router.post('/encerrar-impersonacao', autenticarAdmin, encerrarImpersonacao);

module.exports = router;
