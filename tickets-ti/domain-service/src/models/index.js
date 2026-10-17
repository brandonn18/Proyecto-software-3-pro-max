// Registro de modelos. Los persistentes se enlazan a la conexión con init();
// Usuario (authcore) y Reporte (agregaciones) no tienen tabla propia.
const ticket = require('./Ticket');
const auditLog = require('./AuditLog');
const notification = require('./Notification');
const slaConfig = require('./SLAConfig');
const ticketComentario = require('./TicketComentario');
const { Usuario } = require('./Usuario');
const { Reporte } = require('./Reporte');
const { configurarServicios } = require('./apoyo/servicios');

const definirModelos = (sequelize) => {
  [ticket, auditLog, notification, slaConfig, ticketComentario].forEach((m) => m.iniciar(sequelize));
  return {
    Ticket: ticket.Ticket,
    AuditLog: auditLog.AuditLog,
    Notification: notification.Notification,
    SLAConfig: slaConfig.SLAConfig,
    TicketComentario: ticketComentario.TicketComentario,
    Usuario,
    Reporte,
  };
};

module.exports = { definirModelos, configurarServicios };
