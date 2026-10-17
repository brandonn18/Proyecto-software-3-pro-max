// MODELO Notification: bandeja in-app de cada usuario. Al crear una puede
// empujarla en tiempo real ('notificacion:nueva', que muestra un toast).
const { Model, DataTypes } = require('sequelize');
const { noEncontrado } = require('./apoyo/errores');
const { normalizarPaginacion } = require('./apoyo/paginacion');
const { servicios } = require('./apoyo/servicios');

class Notification extends Model {
  // push false cuando otro evento (ticket:nuevo, ticket:estado_cambiado) ya
  // avisa al usuario, para no duplicar el toast
  static async enviar({ usuarioId, ticketId, tipo, mensaje, push = true }) {
    const notificacion = await this.create({ usuarioId, ticketId, tipo, mensaje });
    if (push) servicios.tiempoReal.emitirAUsuario(usuarioId, 'notificacion:nueva', notificacion.get({ plain: true }));
    return notificacion;
  }

  // Orden: no leídas primero, luego de la más nueva a la más vieja
  static async bandejaDe(actor, { tipo, page, limit } = {}) {
    const paginacion = normalizarPaginacion({ page, limit });
    const where = { usuarioId: actor.id };
    if (tipo) where.tipo = tipo;
    const { count, rows } = await this.findAndCountAll({
      where, order: [['leida', 'ASC'], ['createdAt', 'DESC'], ['id', 'DESC']],
      limit: paginacion.limit, offset: (paginacion.page - 1) * paginacion.limit,
    });
    return { items: rows, total: count, ...paginacion };
  }

  static contarNoLeidasDe(actor) {
    return this.count({ where: { usuarioId: actor.id, leida: false } });
  }

  // Solo el dueño puede marcarla: la de otro usuario cuenta como inexistente
  static async marcarLeidaDe(id, actor) {
    const notificacion = await this.findOne({ where: { id, usuarioId: actor.id } });
    if (!notificacion) throw noEncontrado('Notificación no encontrada');
    return notificacion.update({ leida: true });
  }

  static async marcarTodasLeidasDe(actor) {
    await this.update({ leida: true }, { where: { usuarioId: actor.id, leida: false } });
  }
}

const ATRIBUTOS = {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false },
  ticketId: { type: DataTypes.STRING(20), allowNull: true },
  tipo: { type: DataTypes.STRING(50), allowNull: false },
  mensaje: { type: DataTypes.TEXT, allowNull: false },
  leida: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
};

const iniciar = (sequelize) => Notification.init(ATRIBUTOS, { sequelize, modelName: 'Notification', tableName: 'notifications', updatedAt: false });

module.exports = { Notification, iniciar };
