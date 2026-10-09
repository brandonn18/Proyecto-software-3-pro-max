const { manejar, ok, paginado } = require('./manejar');

// bandeja: caso de uso BandejaNotificaciones
const crearNotificacionesController = (bandeja) => ({
  listar: manejar(async (req, res) => paginado(res, await bandeja.listar(req.actor, req.query))),

  contar: manejar(async (req, res) => ok(res, await bandeja.contarNoLeidas(req.actor))),

  marcarLeida: manejar(async (req, res) => {
    ok(res, await bandeja.marcarLeida(req.params.id, req.actor), 'Notificación marcada como leída');
  }),

  marcarTodas: manejar(async (req, res) => {
    await bandeja.marcarTodasLeidas(req.actor);
    ok(res, null, 'Todas las notificaciones marcadas como leídas');
  }),
});

module.exports = { crearNotificacionesController };
