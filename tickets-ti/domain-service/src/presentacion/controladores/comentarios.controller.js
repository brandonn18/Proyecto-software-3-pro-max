const { manejar, ok } = require('./responder');
const { sanitizarTexto, presentarComentario } = require('../formato');

// comentarios: comentariosService (capa de negocio)
const crearComentariosController = (comentarios) => ({
  listar: manejar(async (req, res) => {
    const filas = await comentarios.listar(req.params.id, req.actor);
    ok(res, filas.map(presentarComentario));
  }),

  comentar: manejar(async (req, res) => {
    const fila = await comentarios.comentar(req.params.id, sanitizarTexto(req.body.texto), req.actor);
    ok(res, presentarComentario(fila), 'Comentario agregado', 201);
  }),
});

module.exports = { crearComentariosController };
