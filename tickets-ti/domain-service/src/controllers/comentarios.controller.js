// CONTROLADOR de la API JSON de comentarios (/api/v1/tickets/:id/comentarios).
const { manejar, sanitizarTexto } = require('./apoyo');
const respuesta = require('../views/respuesta');
const comentarioView = require('../views/comentarioView');

// modelos: los de models/index.js (usa TicketComentario)
const crearComentariosController = ({ TicketComentario }) => ({
  listar: manejar(async (req, res) => {
    const hilo = await TicketComentario.hiloDe(req.params.id, req.actor);
    res.json(respuesta.exito(hilo.map(comentarioView.comentario)));
  }),

  comentar: manejar(async (req, res) => {
    const comentario = await TicketComentario.comentar(req.params.id, req.actor, sanitizarTexto(req.body.texto));
    res.status(201).json(respuesta.exito(comentarioView.comentario(comentario), 'Comentario agregado'));
  }),
});

module.exports = { crearComentariosController };
