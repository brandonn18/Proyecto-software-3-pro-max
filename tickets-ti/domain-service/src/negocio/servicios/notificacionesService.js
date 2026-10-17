// Capa de NEGOCIO: entrega y bandeja de notificaciones in-app.
const { noEncontrado } = require('../../comun/errores');
const { normalizarPaginacion, construirMeta } = require('../reglas/paginacion');

class NotificacionesService {
  // dao.notificaciones: NotificacionesDAO | tiempoReal: TiempoRealSocketIo (capa de datos)
  constructor({ dao, tiempoReal }) {
    this.dao = dao;
    this.tiempoReal = tiempoReal;
  }

  // push false cuando otro evento (ticket:nuevo, ticket:estado_cambiado) ya
  // avisa al usuario, para no duplicar el toast del frontend
  async notificar({ usuarioId, ticketId, tipo, mensaje, push = true }) {
    const notificacion = await this.dao.notificaciones.insertar({ usuarioId, ticketId, tipo, mensaje });
    if (push) this.tiempoReal.emitirAUsuario(usuarioId, 'notificacion:nueva', notificacion);
  }

  async listar(actor, { tipo, page, limit } = {}) {
    const paginacion = normalizarPaginacion({ page, limit });
    const { items, total } = await this.dao.notificaciones.listarDe(actor.id, { tipo, ...paginacion });
    return { items, meta: construirMeta(total, paginacion) };
  }

  async contarNoLeidas(actor) {
    return { unread: await this.dao.notificaciones.contarNoLeidas(actor.id) };
  }

  async marcarLeida(id, actor) {
    const notificacion = await this.dao.notificaciones.marcarLeida(id, actor.id);
    if (!notificacion) throw noEncontrado('Notificación no encontrada');
    return notificacion;
  }

  marcarTodasLeidas(actor) {
    return this.dao.notificaciones.marcarTodasLeidas(actor.id);
  }
}

module.exports = { NotificacionesService };
