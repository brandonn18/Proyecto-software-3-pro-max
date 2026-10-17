// Se monta bajo /api/v1/tickets: GET y POST /:id/comentarios
const { Router } = require('express');
const { body, param } = require('express-validator');
const { validar } = require('../middlewares/validar');
const { LONGITUD_MAXIMA } = require('../../negocio/reglas/reglasComentarios');

const idTicket = param('id').matches(/^TKT-\d{4}-\d{4}$/).withMessage('id de ticket inválido');
const texto = body('texto').isString().withMessage('texto requerido')
  .bail().trim().isLength({ min: 1, max: LONGITUD_MAXIMA }).withMessage(`texto entre 1 y ${LONGITUD_MAXIMA} caracteres`);

const crearRutasComentarios = (ctrl) => {
  const router = Router();
  router.get('/:id/comentarios', idTicket, validar, ctrl.listar);
  router.post('/:id/comentarios', idTicket, texto, validar, ctrl.comentar);
  return router;
};

module.exports = { crearRutasComentarios };
