// Capa de DATOS: bandeja de notificaciones in-app.

const _plano = (fila) => fila.get({ plain: true });

class NotificacionesDAO {
  constructor({ Notification }) {
    if (!Notification) throw new Error('NotificacionesDAO requiere el modelo Notification');
    this.modelo = Notification;
  }

  async insertar({ usuarioId, ticketId, tipo, mensaje }) {
    return _plano(await this.modelo.create({ usuarioId, ticketId, tipo, mensaje }));
  }

  // Orden: no leídas primero, luego de la más nueva a la más vieja
  async listarDe(usuarioId, { tipo, page, limit }) {
    const where = { usuarioId };
    if (tipo) where.tipo = tipo;
    const { count, rows } = await this.modelo.findAndCountAll({
      where, order: [['leida', 'ASC'], ['createdAt', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit,
    });
    return { items: rows.map(_plano), total: count };
  }

  contarNoLeidas(usuarioId) {
    return this.modelo.count({ where: { usuarioId, leida: false } });
  }

  // null si no existe o es de otro usuario
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

module.exports = { NotificacionesDAO };
