const { politicaAcceso, politicaSLA } = require('../../domain');
const { TicketRepository, SLAConfigRepository, AuditoriaRepository, Clock } = require('../ports');
const { requerirDependencias, ticketOFallar } = require('../dependencias');

// CP005: reabre un ticket resuelto o cerrado y reinicia su SLA.
class ReabrirTicket {
  constructor(deps) {
    requerirDependencias(deps, {
      ticketRepository: TicketRepository,
      slaConfigRepository: SLAConfigRepository,
      auditoria: AuditoriaRepository,
      clock: Clock,
    });
    this.deps = deps;
  }

  async ejecutar(ticketId, motivo, actor) {
    const ticket = await ticketOFallar(this.deps.ticketRepository, ticketId);
    politicaAcceso.exigirReabrir(ticket, actor);

    const config = await this.deps.slaConfigRepository.obtenerPorPrioridad(ticket.prioridad);
    const sla = { ahora: this.deps.clock.ahora(), horas: politicaSLA.horasPara(ticket.prioridad, config) };
    const reabierto = await this.deps.ticketRepository.actualizar(ticket.reabrir(motivo, sla));

    await this.deps.auditoria.registrar({
      ticketId: ticket.id, actor, accion: 'TICKET_REABIERTO', detalle: { motivo },
    });
    return reabierto;
  }
}

module.exports = ReabrirTicket;
