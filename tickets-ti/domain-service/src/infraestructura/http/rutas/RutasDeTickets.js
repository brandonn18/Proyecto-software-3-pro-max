const { Router } = require('express');
const { body, query } = require('express-validator');
const { ESTADOS, PRIORIDADES, TIPOS, CATEGORIAS } = require('../../../valores/catalogos');
const Autenticacion = require('../Autenticacion');
const Validacion = require('../Validacion');

const adminOTecnico = Autenticacion.requiereRol('administrador', 'tecnico');
const validar = Validacion.resultado;

const REGLAS_LISTADO = [
  query('page').optional().isInt({ min: 1 }).withMessage('page debe ser entero positivo'),
  query('limit').optional().isInt({ min: 1 }).withMessage('limit debe ser entero positivo'),
  query('estado').optional().isIn(ESTADOS).withMessage('Estado inválido'),
  query('prioridad').optional().isIn(PRIORIDADES).withMessage('Prioridad inválida'),
  query('tipo').optional().isIn(TIPOS).withMessage('Tipo inválido'),
  query('categoria').optional().isIn(CATEGORIAS).withMessage('Categoría inválida'),
  query('tecnicoId').optional().isInt().withMessage('tecnicoId inválido'),
  query(['fechaDesde', 'fechaHasta']).optional().isISO8601().withMessage('Fecha inválida'),
  query('search').optional().isString().isLength({ max: 100 }),
];

const REGLAS_CREACION = [
  body('titulo').isString().notEmpty().isLength({ max: 200 }).withMessage('Título requerido'),
  body('descripcion').isString().notEmpty().withMessage('Descripción requerida'),
  body('tipo').isIn(TIPOS).withMessage('Tipo inválido'),
  body('categoria').isIn(CATEGORIAS).withMessage('Categoría inválida'),
  body('prioridad').optional().isIn(PRIORIDADES).withMessage('Prioridad inválida'),
];

const REGLAS_EDICION = [
  body('titulo').optional().isString().notEmpty().isLength({ max: 200 }),
  body('descripcion').optional().isString().notEmpty(),
  body('tipo').optional().isIn(TIPOS),
  body('categoria').optional().isIn(CATEGORIAS),
  body('prioridad').optional().isIn(PRIORIDADES),
];

// /api/tickets
class RutasDeTickets {
  // ctrl: ControladorDeTickets
  static crear(ctrl) {
    const router = Router();
    router.get('/', REGLAS_LISTADO, validar, ctrl.listar);
    router.get('/:id', ctrl.obtener);
    router.post('/', REGLAS_CREACION, validar, ctrl.crear);
    router.patch('/:id/status', adminOTecnico, [
      body('estado').isIn(ESTADOS).withMessage('Estado inválido'),
      body('comentario').optional({ nullable: true }).isString(),
    ], validar, ctrl.cambiarEstado);
    router.put('/:id', adminOTecnico, REGLAS_EDICION, validar, ctrl.actualizar);
    router.post('/:id/assign', Autenticacion.requiereRol('administrador'), [body('tecnicoId').isInt().withMessage('tecnicoId inválido')], validar, ctrl.asignar);
    router.post('/:id/reopen', [body('motivo_reapertura').isString().notEmpty().withMessage('Motivo de reapertura requerido')], validar, ctrl.reabrir);
    router.delete('/:id', Autenticacion.requiereRol('administrador'), ctrl.eliminar);
    return router;
  }
}

module.exports = RutasDeTickets;
