// Rutas servicio a servicio. Se montan fuera de /api para que el proxy
// público (nginx) nunca las exponga.
const router = require('express').Router();
const { param } = require('express-validator');
const ctrl = require('../controllers/internal.controller');
const { requireInternalKey } = require('../middlewares/internalKey');
const { validar } = require('../middlewares/validar');

router.use(requireInternalKey);

router.get('/users/:id', [param('id').isInt().withMessage('id inválido')], validar, ctrl.getUsuario);
router.get('/tecnicos', ctrl.getTecnicos);

module.exports = router;
