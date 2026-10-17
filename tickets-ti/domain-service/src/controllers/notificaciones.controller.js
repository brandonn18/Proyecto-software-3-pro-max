// CONTROLADOR de la bandeja de notificaciones del usuario autenticado.
const { manejar } = require('./apoyo');
const respuesta = require('../views/respuesta');
const notificacionView = require('../views/notificacionView');

// modelos: los de models/index.js (usa Notification)
const crearNotificacionesController = ({ Notification }) => ({
  listar: manejar(async (req, res) => {
    const pagina = await Notification.bandejaDe(req.actor, req.query);
    res.json(respuesta.paginado(pagina.items.map(notificacionView.notificacion), pagina));
  }),

  contar: manejar(async (req, res) => {
    res.json(respuesta.exito({ unread: await Notification.contarNoLeidasDe(req.actor) }));
  }),

  marcarLeida: manejar(async (req, res) => {
    const notificacion = await Notification.marcarLeidaDe(req.params.id, req.actor);
    res.json(respuesta.exito(notificacionView.notificacion(notificacion), 'Notificación marcada como leída'));
  }),

  marcarTodas: manejar(async (req, res) => {
    await Notification.marcarTodasLeidasDe(req.actor);
    res.json(respuesta.exito(null, 'Todas las notificaciones marcadas como leídas'));
  }),
});

module.exports = { crearNotificacionesController };
