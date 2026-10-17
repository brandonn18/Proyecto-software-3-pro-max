// Servicio Notificador: entrega avisos in-app (bandeja + tiempo real) y
// atiende la bandeja del usuario autenticado.
const { RepositorioDeNotificaciones, CanalEnTiempoReal } = require('../interfaces');
const { ErrorNoEncontrado } = require('../errores');
const Paginacion = require('../valores/Paginacion');
const { Dependencias } = require('./Dependencias');

class Notificador {
  #repositorio;
  #canal;

  constructor(deps) {
    Dependencias.exigir(deps, { repositorio: RepositorioDeNotificaciones, canal: CanalEnTiempoReal });
    this.#repositorio = deps.repositorio;
    this.#canal = deps.canal;
  }

  // push false cuando otro evento (ticket:nuevo, ticket:estado_cambiado) ya
  // avisa al usuario, para no duplicar el toast del frontend
  async notificar({ usuarioId, ticketId, tipo, mensaje, push = true }) {
    const notificacion = await this.#repositorio.guardar({ usuarioId, ticketId, tipo, mensaje });
    if (push) this.#canal.emitirAUsuario(usuarioId, 'notificacion:nueva', notificacion.aJSON());
  }

  async bandejaDe(actor, { tipo, page, limit } = {}) {
    const paginacion = new Paginacion({ page, limit });
    const { items, total } = await this.#repositorio.listarDe(actor.id, { tipo, paginacion });
    return { items, meta: paginacion.meta(total) };
  }

  async contarNoLeidas(actor) {
    return { unread: await this.#repositorio.contarNoLeidas(actor.id) };
  }

  async marcarLeida(id, actor) {
    const notificacion = await this.#repositorio.marcarLeida(id, actor.id);
    if (!notificacion) throw new ErrorNoEncontrado('Notificación no encontrada');
    return notificacion;
  }

  marcarTodasLeidas(actor) {
    return this.#repositorio.marcarTodasLeidas(actor.id);
  }
}

module.exports = Notificador;
