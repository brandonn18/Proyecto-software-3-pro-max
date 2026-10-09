const { AuditLog } = require('../models');

const registrar = (usuarioId, accion, detalle = {}) =>
  AuditLog.create({ usuarioId, accion, detalle });

module.exports = { registrar };
