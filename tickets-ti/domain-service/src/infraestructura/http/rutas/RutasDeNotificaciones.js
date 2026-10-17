const { Router } = require('express');
const { param, query } = require('express-validator');
const Validacion = require('../Validacion');

// /api/notifications
class RutasDeNotificaciones {
  static crear(ctrl) {
    const router = Router();
    router.get('/', [
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1 }),
      query('tipo').optional().isString().isLength({ max: 50 }),
    ], Validacion.resultado, ctrl.listar);
    router.get('/count', ctrl.contar);
    router.patch('/read-all', ctrl.marcarTodas);
    router.patch('/:id/read', [param('id').isInt().withMessage('id inválido')], Validacion.resultado, ctrl.marcarLeida);
    return router;
  }
}

module.exports = RutasDeNotificaciones;
