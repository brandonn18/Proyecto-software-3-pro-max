const { Router } = require('express');
const { body, param } = require('express-validator');
const Validacion = require('../Validacion');
const Comentario = require('../../../entidades/Comentario');

const ID_TICKET = param('id').matches(/^TKT-\d{4}-\d{4}$/).withMessage('id de ticket inválido');
const TEXTO = body('texto').isString().withMessage('texto requerido')
  .bail().trim().isLength({ min: 1, max: Comentario.LONGITUD_MAXIMA })
  .withMessage(`texto entre 1 y ${Comentario.LONGITUD_MAXIMA} caracteres`);

// Se monta bajo /api/v1/tickets: GET y POST /:id/comentarios
class RutasDeComentarios {
  static crear(ctrl) {
    const router = Router();
    router.get('/:id/comentarios', ID_TICKET, Validacion.resultado, ctrl.listar);
    router.post('/:id/comentarios', ID_TICKET, TEXTO, Validacion.resultado, ctrl.comentar);
    return router;
  }
}

module.exports = RutasDeComentarios;
