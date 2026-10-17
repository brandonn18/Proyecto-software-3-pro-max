// MODELO AuditLog: bitácora de acciones sobre tickets. El nombre del actor se
// guarda como snapshot para no consultar authcore al mostrar el historial.
const { Model, DataTypes } = require('sequelize');

class AuditLog extends Model {
  static registrar({ ticketId, actor, accion, detalle }) {
    return this.create({ ticketId, accion, detalle, usuarioId: actor?.id ?? null, usuario_nombre: actor?.nombre ?? null });
  }

  static historialDe(ticketId) {
    return this.findAll({ where: { ticketId }, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
  }
}

const ATRIBUTOS = {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ticketId: { type: DataTypes.STRING(20), allowNull: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: true },
  usuario_nombre: { type: DataTypes.STRING(100), allowNull: true },
  accion: { type: DataTypes.STRING(100), allowNull: false },
  detalle: { type: DataTypes.JSONB, allowNull: true },
};

const iniciar = (sequelize) => AuditLog.init(ATRIBUTOS, { sequelize, modelName: 'AuditLog', tableName: 'audit_logs', updatedAt: false });

module.exports = { AuditLog, iniciar };
