const express = require('express');
const { autenticarAdmin } = require('../middleware/auth');
const configPublicoController = require('../controllers/configPublicoController');

const router = express.Router();

router.get('/', configPublicoController.obterPublico);

/**
 * Edição de branding só é permitida durante impersonation (super admin
 * "entrando como" o tenant) — não pelo login normal do admin. É a única
 * forma de editar cor/fonte/logo nesta fase (Fase 6B ainda não existe painel
 * de branding próprio do tenant).
 */
function exigirImpersonando(req, res, next) {
  if (!req.impersonando) {
    return res.status(403).json({ erro: 'Editar a marca só é permitido durante uma sessão de impersonation do super admin' });
  }
  next();
}

router.patch('/branding', autenticarAdmin, exigirImpersonando, configPublicoController.atualizarBranding);

module.exports = router;
