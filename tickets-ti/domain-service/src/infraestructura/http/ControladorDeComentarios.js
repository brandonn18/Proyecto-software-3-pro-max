const ControladorBase = require('./ControladorBase');
const GestorDeComentarios = require('../../servicios/GestorDeComentarios');

class ControladorDeComentarios extends ControladorBase {
  #gestor;

  constructor(gestor) {
    super();
    if (!(gestor instanceof GestorDeComentarios)) throw new TypeError('ControladorDeComentarios requiere un GestorDeComentarios');
    this.#gestor = gestor;
  }

  listar = this.accion(async (req, res) => {
    const comentarios = await this.#gestor.listar(req.params.id, req.actor);
    this.responder(res, comentarios.map((c) => c.aJSON()));
  });

  comentar = this.accion(async (req, res) => {
    const comentario = await this.#gestor.comentar(req.params.id, this.sanitizar(req.body.texto), req.actor);
    this.responder(res, comentario.aJSON(), 'Comentario agregado', 201);
  });
}

module.exports = ControladorDeComentarios;
