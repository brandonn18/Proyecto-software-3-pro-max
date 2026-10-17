// Capa de NEGOCIO: cambios de estado (CP004, CP012) y reapertura (CP005).
const politicaAcceso = require('../reglas/politicaAcceso');
const politicaSLA = require('../reglas/politicaSLA');
const { cambiosDeEstado, cambiosDeReapertura } = require('../reglas/reglasTicket');
const mensajes = require('../reglas/mensajes');
const { enSegundoPlano, ticketOFallar } = require('./apoyo');

class CicloDeVidaService {
  // deps: { dao, directorio, correo, tiempoReal, notificaciones (servicio), reloj, logger }
  constructor(deps) {
    this.deps = deps;
    this.dao = deps.dao;
  }

  async cambiarEstado(ticketId, { estado, comentario }, actor) {
    const ticket = await ticketOFallar(this.dao.tickets, ticketId);
    politicaAcceso.exigirCambiarEstado(ticket, actor);
    const actualizado = await this.dao.tickets.actualizar(ticket.id, cambiosDeEstado(ticket, estado));
    await this.dao.auditoria.registrar({
      ticketId: ticket.id, actor, accion: 'CAMBIO_ESTADO', detalle: { de: ticket.estado, a: estado, comentario },
    });
    if (estado === 'resuelto') await this._avisarResolucion(actualizado, ticket.estado);
    return actualizado;
  }

  async _avisarResolucion(ticket, estadoAnterior) {
    const { notificaciones, tiempoReal, correo, directorio, logger } = this.deps;
    await notificaciones.notificar({
      usuarioId: ticket.usuarioId, ticketId: ticket.id, tipo: 'resolucion',
      mensaje: mensajes.resolucion(ticket), push: false, // ya avisa ticket:estado_cambiado
    });
    tiempoReal.emitirAUsuario(ticket.usuarioId, 'ticket:estado_cambiado', {
      ticketId: ticket.id, estadoAnterior, nuevoEstado: ticket.estado,
    });
    enSegundoPlano(logger, 'Email resolución', async () => {
      const usuario = await directorio.obtenerUsuario(ticket.usuarioId);
      if (usuario) await correo.enviarTicketResuelto(usuario, ticket);
    });
  }

  // Reinicia el SLA desde ahora con las horas de la prioridad
  async reabrir(ticketId, motivo, actor) {
    const ticket = await ticketOFallar(this.dao.tickets, ticketId);
    politicaAcceso.exigirReabrir(ticket, actor);
    const config = await this.dao.slaConfig.obtenerPorPrioridad(ticket.prioridad);
    const sla = { ahora: this.deps.reloj.ahora(), horas: politicaSLA.horasPara(ticket.prioridad, config) };
    const reabierto = await this.dao.tickets.actualizar(ticket.id, cambiosDeReapertura(ticket, motivo, sla));
    await this.dao.auditoria.registrar({ ticketId: ticket.id, actor, accion: 'TICKET_REABIERTO', detalle: { motivo } });
    return reabierto;
  }
}

module.exports = { CicloDeVidaService };
