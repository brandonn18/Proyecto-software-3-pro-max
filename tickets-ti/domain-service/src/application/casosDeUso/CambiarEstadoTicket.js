const { politicaAcceso } = require('../../domain');
const {
  TicketRepository, AuditoriaRepository, NotificationPort, RealtimePort, EmailPort, UserDirectoryPort,
} = require('../ports');
const { requerirDependencias, loggerPorDefecto, enSegundoPlano, ticketOFallar } = require('../dependencias');
const mensajes = require('../mensajes');

// CP004 / CP012: cambio de estado validado por el ciclo de vida del dominio.
class CambiarEstadoTicket {
  constructor(deps) {
    requerirDependencias(deps, {
      ticketRepository: TicketRepository,
      auditoria: AuditoriaRepository,
      notificaciones: NotificationPort,
      realtime: RealtimePort,
      email: EmailPort,
      userDirectory: UserDirectoryPort,
    });
    this.deps = { logger: loggerPorDefecto, ...deps };
  }

  async ejecutar(ticketId, { estado, comentario }, actor) {
    const ticket = await ticketOFallar(this.deps.ticketRepository, ticketId);
    politicaAcceso.exigirCambiarEstado(ticket, actor);

    const actualizado = await this.deps.ticketRepository.actualizar(ticket.cambiarEstado(estado));
    await this.deps.auditoria.registrar({
      ticketId: ticket.id, actor, accion: 'CAMBIO_ESTADO',
      detalle: { de: ticket.estado, a: estado, comentario },
    });
    if (estado === 'resuelto') await this._avisarResolucion(actualizado, ticket.estado);
    return actualizado;
  }

  async _avisarResolucion(ticket, estadoAnterior) {
    const { notificaciones, realtime, email, userDirectory, logger } = this.deps;
    await notificaciones.notificar({
      usuarioId: ticket.usuarioId, ticketId: ticket.id, tipo: 'resolucion', mensaje: mensajes.resolucion(ticket),
    });
    realtime.emitirAUsuario(ticket.usuarioId, 'ticket:estado_cambiado', {
      ticketId: ticket.id, estadoAnterior, nuevoEstado: ticket.estado,
    });
    enSegundoPlano(logger, 'Email resolución', async () => {
      const usuario = await userDirectory.obtenerUsuario(ticket.usuarioId);
      if (usuario) await email.enviarTicketResuelto(usuario, ticket);
    });
  }
}

module.exports = CambiarEstadoTicket;
