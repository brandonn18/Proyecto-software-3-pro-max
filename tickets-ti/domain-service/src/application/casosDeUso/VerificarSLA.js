const { politicaSLA } = require('../../domain');
const {
  TicketRepository, SLAConfigRepository, NotificationPort, RealtimePort, EmailPort, UserDirectoryPort, Clock,
} = require('../ports');
const { requerirDependencias, loggerPorDefecto, enSegundoPlano } = require('../dependencias');
const mensajes = require('../mensajes');

// CP010: lo dispara el cron cada 15 min. Alerta al técnico cuando un ticket
// activo consumió el porcentaje configurado de su SLA (80% por defecto).
class VerificarSLA {
  constructor(deps) {
    requerirDependencias(deps, {
      ticketRepository: TicketRepository,
      slaConfigRepository: SLAConfigRepository,
      notificaciones: NotificationPort,
      realtime: RealtimePort,
      email: EmailPort,
      userDirectory: UserDirectoryPort,
      clock: Clock,
    });
    this.deps = { logger: loggerPorDefecto, ...deps };
  }

  // Devuelve cuántas alertas se generaron
  async ejecutar() {
    const ahora = this.deps.clock.ahora();
    const candidatos = await this.deps.ticketRepository.listarPendientesDeAlertaSLA();
    const configs = new Map();
    let alertas = 0;
    for (const ticket of candidatos) {
      const config = await this._configDe(ticket.prioridad, configs);
      const { porcentaje, alertar } = ticket.evaluarSLA({
        ahora, horas: politicaSLA.horasPara(ticket.prioridad, config), porcentajeAlerta: config?.porcentaje_alerta,
      });
      if (alertar) {
        await this._alertar(ticket, porcentaje);
        alertas++;
      }
    }
    return alertas;
  }

  async _configDe(prioridad, cache) {
    if (!cache.has(prioridad)) cache.set(prioridad, await this.deps.slaConfigRepository.obtenerPorPrioridad(prioridad));
    return cache.get(prioridad);
  }

  async _alertar(ticket, porcentaje) {
    const { notificaciones, realtime, email, userDirectory, ticketRepository, logger } = this.deps;
    const redondeado = Math.round(porcentaje);
    await notificaciones.notificar({
      usuarioId: ticket.tecnicoId, ticketId: ticket.id, tipo: 'sla_alerta',
      mensaje: mensajes.alertaSLA(ticket, porcentaje), push: true,
    });
    enSegundoPlano(logger, 'Email SLA', async () => {
      const tecnico = await userDirectory.obtenerUsuario(ticket.tecnicoId);
      if (tecnico) await email.enviarAlertaSLA(tecnico, ticket, porcentaje);
    });
    realtime.emitirATecnico(ticket.tecnicoId, 'ticket:sla_alerta', { ticketId: ticket.id, porcentaje: redondeado });
    realtime.emitirAAdmins('ticket:sla_alerta', { ticketId: ticket.id, porcentaje: redondeado });
    await ticketRepository.actualizar(ticket.marcarAlertaSLAEnviada());
  }
}

module.exports = VerificarSLA;
