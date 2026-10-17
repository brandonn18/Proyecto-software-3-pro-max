// Implementación concreta de RepositorioDeNotificaciones sobre Sequelize.
const { RepositorioDeNotificaciones } = require('../../interfaces');
const Notificacion = require('../../entidades/Notificacion');

const _aEntidad = (fila) => new Notificacion(fila.get({ plain: true }));

class RepositorioDeNotificacionesSequelize extends RepositorioDeNotificaciones {
  #modelo;

  constructor({ Notification }) {
    super();
    if (!Notification) throw new Error('RepositorioDeNotificacionesSequelize requiere el modelo Notification');
    this.#modelo = Notification;
  }

  async guardar({ usuarioId, ticketId, tipo, mensaje }) {
    return _aEntidad(await this.#modelo.create({ usuarioId, ticketId, tipo, mensaje }));
  }

  async listarDe(usuarioId, { tipo, paginacion }) {
    const where = { usuarioId };
    if (tipo) where.tipo = tipo;
    const { count, rows } = await this.#modelo.findAndCountAll({
      where, order: [['leida', 'ASC'], ['createdAt', 'DESC'], ['id', 'DESC']], limit: paginacion.limit, offset: paginacion.offset,
    });
    return { items: rows.map(_aEntidad), total: count };
  }

  contarNoLeidas(usuarioId) {
    return this.#modelo.count({ where: { usuarioId, leida: false } });
  }

  async marcarLeida(id, usuarioId) {
    const fila = await this.#modelo.findOne({ where: { id, usuarioId } });
    if (!fila) return null;
    await fila.update({ leida: true });
    return _aEntidad(fila);
  }

  async marcarTodasLeidas(usuarioId) {
    await this.#modelo.update({ leida: true }, { where: { usuarioId, leida: false } });
  }
}

module.exports = RepositorioDeNotificacionesSequelize;
