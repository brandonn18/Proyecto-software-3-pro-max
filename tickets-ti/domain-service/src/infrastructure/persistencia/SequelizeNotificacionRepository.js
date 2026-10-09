const { NotificacionRepository } = require('../../application/ports');

const _plano = (fila) => fila.get({ plain: true });

class SequelizeNotificacionRepository extends NotificacionRepository {
  constructor({ Notification }) {
    super();
    this.modelo = Notification;
  }

  // Lo usa NotificacionInAppAdapter para guardar antes de empujar el evento
  async crear({ usuarioId, ticketId, tipo, mensaje }) {
    return _plano(await this.modelo.create({ usuarioId, ticketId, tipo, mensaje }));
  }

  async listarDe(usuarioId, { tipo, page, limit }) {
    const where = { usuarioId };
    if (tipo) where.tipo = tipo;
    const { count, rows } = await this.modelo.findAndCountAll({
      where,
      order: [['leida', 'ASC'], ['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return { items: rows.map(_plano), total: count };
  }

  contarNoLeidas(usuarioId) {
    return this.modelo.count({ where: { usuarioId, leida: false } });
  }

  async marcarLeida(id, usuarioId) {
    const notificacion = await this.modelo.findOne({ where: { id, usuarioId } });
    if (!notificacion) return null;
    await notificacion.update({ leida: true });
    return _plano(notificacion);
  }

  async marcarTodasLeidas(usuarioId) {
    await this.modelo.update({ leida: true }, { where: { usuarioId, leida: false } });
  }
}

module.exports = SequelizeNotificacionRepository;
