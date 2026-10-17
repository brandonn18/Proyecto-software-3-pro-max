// Rutas del panel HTML. Se monta bajo /api/v1/mvc/tickets y solo lo usa el
// administrador. El formulario llega como application/x-www-form-urlencoded.
const express = require('express');
const { body, param } = require('express-validator');
const { requireRole } = require('../middlewares/autenticacion');
const { LONGITUD_MAXIMA } = require('../models/TicketComentario');

const idTicket = param('id').matches(/^TKT-\d{4}-\d{4}$/).withMessage('id de ticket inválido');
const texto = body('texto').isString().withMessage('Escribe un comentario')
  .bail().trim().isLength({ min: 1, max: LONGITUD_MAXIMA }).withMessage(`El comentario debe tener entre 1 y ${LONGITUD_MAXIMA} caracteres`);

const crearRutasPanelComentarios = (ctrl) => {
  const router = express.Router();
  router.use(requireRole('administrador'));
  router.get('/:id/comentarios', idTicket, ctrl.mostrar);
  router.post('/:id/comentarios', express.urlencoded({ extended: false, limit: '20kb' }), idTicket, texto, ctrl.comentar);
  return router;
};

module.exports = { crearRutasPanelComentarios };
