const ControladorBase = require('./ControladorBase');
const Notificador = require('../../servicios/Notificador');

class ControladorDeNotificaciones extends ControladorBase {
  #notificador;

  constructor(notificador) {
    super();
    if (!(notificador instanceof Notificador)) throw new TypeError('ControladorDeNotificaciones requiere un Notificador');
    this.#notificador = notificador;
  }

  listar = this.accion(async (req, res) => {
    const { items, meta } = await this.#notificador.bandejaDe(req.actor, req.query);
    this.paginar(res, items.map((n) => n.aJSON()), meta);
  });

  contar = this.accion(async (req, res) => this.responder(res, await this.#notificador.contarNoLeidas(req.actor)));

  marcarLeida = this.accion(async (req, res) => {
    const notificacion = await this.#notificador.marcarLeida(req.params.id, req.actor);
    this.responder(res, notificacion.aJSON(), 'Notificación marcada como leída');
  });

  marcarTodas = this.accion(async (req, res) => {
    await this.#notificador.marcarTodasLeidas(req.actor);
    this.responder(res, null, 'Todas las notificaciones marcadas como leídas');
  });
}

module.exports = ControladorDeNotificaciones;
