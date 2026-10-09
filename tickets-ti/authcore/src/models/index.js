const { sequelize } = require('../config/db');
const User = require('./User');
const AuditLog = require('./AuditLog');

User.hasMany(AuditLog, { foreignKey: 'usuarioId', as: 'auditorias' });
AuditLog.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

module.exports = { sequelize, User, AuditLog };
