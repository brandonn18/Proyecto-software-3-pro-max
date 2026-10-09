const { NotificacionRepository } = require('../ports');
const { requerirDependencias, noEncontrado } = require('../dependencias');
const { normalizarPaginacion, construirMeta } = require('../paginacion');

// Bandeja de notificaciones in-app del usuario autenticado.
class BandejaNotificaciones {
  constructor(deps) {
    requerirDependencias(deps, { notificacionRepository: NotificacionRepository });
    this.repo = deps.notificacionRepository;
  }

  async listar(actor, { tipo, page, limit } = {}) {
    const paginacion = normalizarPaginacion({ page, limit });
    const { items, total } = await this.repo.listarDe(actor.id, { tipo, ...paginacion });
    return { items, meta: construirMeta(total, paginacion) };
  }

  async contarNoLeidas(actor) {
    return { unread: await this.repo.contarNoLeidas(actor.id) };
  }

  async marcarLeida(id, actor) {
    const notificacion = await this.repo.marcarLeida(id, actor.id);
    if (!notificacion) throw noEncontrado('Notificación no encontrada');
    return notificacion;
  }

  marcarTodasLeidas(actor) {
    return this.repo.marcarTodasLeidas(actor.id);
  }
}

module.exports = BandejaNotificaciones;
