const { definirPuerto, verificarPuerto } = require('./definirPuerto');

module.exports = {
  definirPuerto,
  verificarPuerto,
  TicketRepository: require('./TicketRepository'),
  AuditoriaRepository: require('./AuditoriaRepository'),
  NotificationPort: require('./NotificationPort'),
  NotificacionRepository: require('./NotificacionRepository'),
  RealtimePort: require('./RealtimePort'),
  EmailPort: require('./EmailPort'),
  UserDirectoryPort: require('./UserDirectoryPort'),
  Clock: require('./Clock'),
  SLAConfigRepository: require('./SLAConfigRepository'),
  ReportesQueryPort: require('./ReportesQueryPort'),
};
