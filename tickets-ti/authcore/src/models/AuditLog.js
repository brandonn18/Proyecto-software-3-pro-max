const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Auditoría de acciones sobre cuentas (login, logout, gestión de usuarios).
// La auditoría de tickets vive en domain-service.
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: true },
  accion: { type: DataTypes.STRING(100), allowNull: false },
  detalle: { type: DataTypes.JSONB, allowNull: true },
}, {
  tableName: 'audit_logs',
  updatedAt: false,
});

module.exports = AuditLog;
