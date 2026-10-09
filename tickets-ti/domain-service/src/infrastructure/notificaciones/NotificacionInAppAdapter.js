const { NotificationPort, RealtimePort, verificarPuerto } = require('../../application/ports');

// NotificationPort = guardar en la bandeja + (opcional) empujar por tiempo real.
// Compone el repositorio y el RealtimePort en vez de conocer Sequelize o Socket.io.
class NotificacionInAppAdapter extends NotificationPort {
  // repositorio: { crear(notificacion) } (SequelizeNotificacionRepository)
  constructor({ repositorio, realtime }) {
    super();
    if (typeof repositorio?.crear !== 'function') throw new Error('NotificacionInAppAdapter requiere repositorio.crear');
    this.repositorio = repositorio;
    this.realtime = verificarPuerto(realtime, RealtimePort, 'realtime');
  }

  async notificar({ usuarioId, ticketId, tipo, mensaje, push = true }) {
    const notificacion = await this.repositorio.crear({ usuarioId, ticketId, tipo, mensaje });
    if (push) this.realtime.emitirAUsuario(usuarioId, 'notificacion:nueva', notificacion);
  }
}

module.exports = NotificacionInAppAdapter;
