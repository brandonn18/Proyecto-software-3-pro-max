const {
  TicketRepository, UserDirectoryPort, AuditoriaRepository, NotificationPort, EmailPort,
} = require('../ports');
const {
  requerirDependencias, loggerPorDefecto, enSegundoPlano, noEncontrado, ticketOFallar,
} = require('../dependencias');
const mensajes = require('../mensajes');

const _esTecnicoActivo = (persona) => Boolean(persona) && persona.rol === 'tecnico' && persona.activo;

// Asignación manual por un administrador.
class AsignarTicket {
  constructor(deps) {
    requerirDependencias(deps, {
      ticketRepository: TicketRepository,
      userDirectory: UserDirectoryPort,
      auditoria: AuditoriaRepository,
      notificaciones: NotificationPort,
      email: EmailPort,
    });
    this.deps = { logger: loggerPorDefecto, ...deps };
  }

  async ejecutar(ticketId, tecnicoId, actor) {
    const ticket = await ticketOFallar(this.deps.ticketRepository, ticketId);
    const tecnico = await this.deps.userDirectory.obtenerUsuario(tecnicoId);
    if (!_esTecnicoActivo(tecnico)) throw noEncontrado('Técnico no encontrado o inactivo');

    const asignado = await this.deps.ticketRepository.actualizar(ticket.asignarA(tecnico));
    await this._registrarYAvisar(asignado, tecnico, actor);
    return asignado;
  }

  async _registrarYAvisar(ticket, tecnico, actor) {
    const { auditoria, notificaciones, email, logger } = this.deps;
    await auditoria.registrar({
      ticketId: ticket.id, actor, accion: 'TICKET_ASIGNADO',
      detalle: { tecnicoId: tecnico.id, tecnicoNombre: tecnico.nombre },
    });
    await notificaciones.notificar({
      usuarioId: tecnico.id, ticketId: ticket.id, tipo: 'asignacion', mensaje: mensajes.asignacion(ticket), push: true,
    });
    enSegundoPlano(logger, 'Email asignación', () => email.enviarTicketAsignado(tecnico, ticket));
  }
}

module.exports = AsignarTicket;
