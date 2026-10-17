const { manejar, ok, paginado } = require('./responder');

// notificaciones: notificacionesService (capa de negocio)
const crearNotificacionesController = (notificaciones) => ({
  listar: manejar(async (req, res) => paginado(res, await notificaciones.listar(req.actor, req.query))),

  contar: manejar(async (req, res) => ok(res, await notificaciones.contarNoLeidas(req.actor))),

  marcarLeida: manejar(async (req, res) => {
    ok(res, await notificaciones.marcarLeida(req.params.id, req.actor), 'Notificación marcada como leída');
  }),

  marcarTodas: manejar(async (req, res) => {
    await notificaciones.marcarTodasLeidas(req.actor);
    ok(res, null, 'Todas las notificaciones marcadas como leídas');
  }),
});

module.exports = { crearNotificacionesController };
