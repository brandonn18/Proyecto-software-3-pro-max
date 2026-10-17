// Fachada de la capa de DATOS: lo único que las capas de arriba importan de
// ella. Agrupa la conexión, los DAO y las integraciones externas.
const { crearSequelize } = require('./conexion');
const { definirModelos } = require('./modelos');
const { TicketsDAO } = require('./dao/ticketsDAO');
const { AuditoriaDAO } = require('./dao/auditoriaDAO');
const { NotificacionesDAO } = require('./dao/notificacionesDAO');
const { SLAConfigDAO } = require('./dao/slaConfigDAO');
const { ReportesDAO } = require('./dao/reportesDAO');
const { ComentariosDAO } = require('./dao/comentariosDAO');

const crearDAOs = (modelos, sequelize) => ({
  tickets: new TicketsDAO(modelos),
  auditoria: new AuditoriaDAO(modelos),
  notificaciones: new NotificacionesDAO(modelos),
  slaConfig: new SLAConfigDAO(modelos),
  reportes: new ReportesDAO(modelos, sequelize),
  comentarios: new ComentariosDAO(modelos),
});

module.exports = {
  crearSequelize,
  definirModelos,
  crearDAOs,
  DirectorioAuthcore: require('./integraciones/directorioAuthcore'),
  ...require('./integraciones/correo'),
  ...require('./integraciones/tiempoReal'),
  ...require('./integraciones/tokens'),
};
