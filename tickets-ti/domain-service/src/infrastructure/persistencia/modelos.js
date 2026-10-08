const { DataTypes } = require('sequelize');
const { ESTADOS, PRIORIDADES, TIPOS, CATEGORIAS } = require('../../domain/catalogos');

// Sin tabla users ni FKs hacia ella: los usuarios viven en authcore y aquí
// solo se guardan sus ids y nombres como snapshot.

const definirTicket = (sequelize) => sequelize.define('Ticket', {
  id: { type: DataTypes.STRING(20), primaryKey: true },
  titulo: { type: DataTypes.STRING(200), allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: false },
  tipo: { type: DataTypes.ENUM(...TIPOS), allowNull: false },
  categoria: { type: DataTypes.ENUM(...CATEGORIAS), allowNull: false },
  prioridad: { type: DataTypes.ENUM(...PRIORIDADES), allowNull: false, defaultValue: 'media' },
  estado: { type: DataTypes.ENUM(...ESTADOS), allowNull: false, defaultValue: 'abierto' },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false },
  usuario_nombre: { type: DataTypes.STRING(100), allowNull: false },
  tecnicoId: { type: DataTypes.INTEGER, allowNull: true },
  tecnico_nombre: { type: DataTypes.STRING(100), allowNull: true },
  reabierto: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  motivo_reapertura: { type: DataTypes.TEXT, allowNull: true },
  sla_limite: { type: DataTypes.DATE, allowNull: true },
  sla_alerta_enviada: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'tickets', timestamps: true, paranoid: true });

const definirAuditLog = (sequelize) => sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ticketId: { type: DataTypes.STRING(20), allowNull: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: true },
  usuario_nombre: { type: DataTypes.STRING(100), allowNull: true },
  accion: { type: DataTypes.STRING(100), allowNull: false },
  detalle: { type: DataTypes.JSONB, allowNull: true },
}, { tableName: 'audit_logs', updatedAt: false });

const definirNotification = (sequelize) => sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false },
  ticketId: { type: DataTypes.STRING(20), allowNull: true },
  tipo: { type: DataTypes.STRING(50), allowNull: false },
  mensaje: { type: DataTypes.TEXT, allowNull: false },
  leida: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'notifications', updatedAt: false });

const definirSLAConfig = (sequelize) => sequelize.define('SLAConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  prioridad: { type: DataTypes.ENUM(...PRIORIDADES), allowNull: false, unique: true },
  tiempo_horas: { type: DataTypes.INTEGER, allowNull: false },
  porcentaje_alerta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 80 },
}, { tableName: 'sla_configs', timestamps: true });

const definirModelos = (sequelize) => ({
  Ticket: definirTicket(sequelize),
  AuditLog: definirAuditLog(sequelize),
  Notification: definirNotification(sequelize),
  SLAConfig: definirSLAConfig(sequelize),
});

module.exports = { definirModelos };
