const { Router } = require('express');
const { param, query } = require('express-validator');
const { validar } = require('../middlewares/validar');

const crearRutasNotificaciones = (ctrl) => {
  const router = Router();
  router.get('/', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1 }),
    query('tipo').optional().isString().isLength({ max: 50 }),
  ], validar, ctrl.listar);
  router.get('/count', ctrl.contar);
  router.patch('/read-all', ctrl.marcarTodas);
  router.patch('/:id/read', [param('id').isInt().withMessage('id inválido')], validar, ctrl.marcarLeida);
  return router;
};

module.exports = { crearRutasNotificaciones };
