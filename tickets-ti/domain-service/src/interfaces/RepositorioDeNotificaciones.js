const { ErrorNoImplementado } = require('../errores');

/**
 * Interfaz (clase abstracta) RepositorioDeNotificaciones. Bandeja de notificaciones in-app.
 * Las implementaciones la extienden y sobrescriben cada método.
 *
 * guardar({ usuarioId, ticketId, tipo, mensaje }) → Promise<Notificacion>
 * listarDe(usuarioId, { tipo?, paginacion })      → Promise<{ items: Notificacion[], total }>  no leídas primero
 * contarNoLeidas(usuarioId)                       → Promise<number>
 * marcarLeida(id, usuarioId)                      → Promise<Notificacion|null>  null si no existe o es de otro usuario
 * marcarTodasLeidas(usuarioId)                    → Promise<void>
 */
class RepositorioDeNotificaciones {
  constructor() {
    if (new.target === RepositorioDeNotificaciones) throw new TypeError('RepositorioDeNotificaciones es abstracta');
  }

  async guardar() { throw new ErrorNoImplementado(this, 'guardar'); }

  async listarDe() { throw new ErrorNoImplementado(this, 'listarDe'); }

  async contarNoLeidas() { throw new ErrorNoImplementado(this, 'contarNoLeidas'); }

  async marcarLeida() { throw new ErrorNoImplementado(this, 'marcarLeida'); }

  async marcarTodasLeidas() { throw new ErrorNoImplementado(this, 'marcarTodasLeidas'); }
}

module.exports = RepositorioDeNotificaciones;
