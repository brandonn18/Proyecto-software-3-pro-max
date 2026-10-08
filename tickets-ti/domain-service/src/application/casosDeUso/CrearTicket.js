const { Ticket, idTicket, politicaSLA } = require('../../domain');
const {
  TicketRepository, SLAConfigRepository, AuditoriaRepository, NotificationPort, Clock,
} = require('../ports');
const { requerirDependencias } = require('../dependencias');
const { ErrorIdDuplicado } = require('../errores');
const mensajes = require('../mensajes');

const MAX_REINTENTOS_ID = 10;

// CP001: crea el ticket con ID correlativo, SLA según prioridad, auditoría,
// notificación al creador y asignación automática (CP003).
class CrearTicket {
  // asignarAutomaticamente: caso de uso AsignarAutomaticamente (o cualquier { ejecutar(ticket) })
  constructor(deps) {
    requerirDependencias(deps, {
      ticketRepository: TicketRepository,
      slaConfigRepository: SLAConfigRepository,
      auditoria: AuditoriaRepository,
      notificaciones: NotificationPort,
      clock: Clock,
    });
    if (typeof deps.asignarAutomaticamente?.ejecutar !== 'function') {
      throw new Error('CrearTicket requiere asignarAutomaticamente.ejecutar(ticket)');
    }
    this.deps = deps;
  }

  // datos: { titulo, descripcion, tipo, categoria, prioridad? } | actor: { id, nombre } (claims del JWT)
  async ejecutar(datos, actor) {
    const ahora = this.deps.clock.ahora();
    const prioridad = datos.prioridad || 'media';
    const config = await this.deps.slaConfigRepository.obtenerPorPrioridad(prioridad);
    const sla = { ahora, horas: politicaSLA.horasPara(prioridad, config) };

    const ticket = await this._guardarConIdUnico({ ...datos, prioridad, creador: actor }, sla);
    await this._registrarCreacion(ticket, actor);
    return this.deps.asignarAutomaticamente.ejecutar(ticket);
  }

  // Reintenta ante colisión de ID por creación concurrente
  async _guardarConIdUnico(datos, sla) {
    const anio = sla.ahora.getFullYear();
    for (let intento = 0; intento <= MAX_REINTENTOS_ID; intento++) {
      const correlativo = (await this.deps.ticketRepository.contarDelAnio(anio)) + 1 + intento;
      const ticket = Ticket.crear({ ...datos, id: idTicket.formatear(anio, correlativo) }, sla);
      try {
        return await this.deps.ticketRepository.guardarNuevo(ticket);
      } catch (err) {
        if (!(err instanceof ErrorIdDuplicado)) throw err;
      }
    }
    throw new Error(`No se pudo generar un ID único tras ${MAX_REINTENTOS_ID} reintentos`);
  }

  async _registrarCreacion(ticket, actor) {
    await this.deps.auditoria.registrar({
      ticketId: ticket.id, actor, accion: 'TICKET_CREADO',
      detalle: { titulo: ticket.titulo, categoria: ticket.categoria, prioridad: ticket.prioridad },
    });
    await this.deps.notificaciones.notificar({
      usuarioId: actor.id, ticketId: ticket.id, tipo: 'creacion', mensaje: mensajes.creacion(ticket),
    });
  }
}

module.exports = CrearTicket;
