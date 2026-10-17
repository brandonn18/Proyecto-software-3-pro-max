// Servicio CicloDeVida: cambios de estado (CP004, CP012) y reapertura (CP005).
// Quién puede lo decide el Actor; a qué estado se puede pasar, el EstadoDeTicket.
const {
  RepositorioDeConfiguracionSLA, RepositorioDeAuditoria, CanalEnTiempoReal, ServicioDeCorreo, DirectorioDeUsuarios, Reloj,
} = require('../interfaces');
const { ErrorDeAcceso } = require('../errores');
const EventoDeAuditoria = require('../entidades/EventoDeAuditoria');
const VentanaSLA = require('../valores/VentanaSLA');
const ServicioDeTickets = require('./ServicioDeTickets');
const Notificador = require('./Notificador');
const MensajesDeNotificacion = require('./MensajesDeNotificacion');
const { Dependencias, TareasEnSegundoPlano } = require('./Dependencias');

class CicloDeVida extends ServicioDeTickets {
  #deps;
  #segundoPlano;

  // deps: { tickets, configuracionSLA, auditoria, notificador, canal, correo, directorio, reloj, logger? }
  constructor(deps) {
    super(deps?.tickets);
    this.#deps = Dependencias.exigir(deps, {
      configuracionSLA: RepositorioDeConfiguracionSLA, auditoria: RepositorioDeAuditoria, notificador: Notificador,
      canal: CanalEnTiempoReal, correo: ServicioDeCorreo, directorio: DirectorioDeUsuarios, reloj: Reloj,
    });
    this.#segundoPlano = new TareasEnSegundoPlano(deps.logger);
  }

  async cambiarEstado(ticketId, { estado, comentario }, actor) {
    const ticket = await this._ticketOFallar(ticketId);
    if (!actor.puedeCambiarEstado(ticket)) throw new ErrorDeAcceso('Sin permiso para modificar este ticket');
    const anterior = ticket.estado.nombre;
    ticket.cambiarEstadoA(estado);
    const actualizado = await this._tickets.actualizar(ticket);
    await this.#deps.auditoria.registrar(new EventoDeAuditoria({
      ticketId: ticket.id, actor, accion: 'CAMBIO_ESTADO', detalle: { de: anterior, a: estado, comentario },
    }));
    if (estado === 'resuelto') await this.#avisarResolucion(actualizado, anterior);
    return actualizado;
  }

  async #avisarResolucion(ticket, estadoAnterior) {
    const { notificador, canal, directorio, correo } = this.#deps;
    const usuarioId = ticket.solicitante.id;
    await notificador.notificar({
      usuarioId, ticketId: ticket.id, tipo: 'resolucion', mensaje: MensajesDeNotificacion.resolucion(ticket), push: false, // ya avisa ticket:estado_cambiado
    });
    canal.emitirAUsuario(usuarioId, 'ticket:estado_cambiado', { ticketId: ticket.id, estadoAnterior, nuevoEstado: ticket.estado.nombre });
    this.#segundoPlano.lanzar('Email resolución', async () => {
      const usuario = await directorio.obtenerUsuario(usuarioId);
      if (usuario) await correo.enviarTicketResuelto(usuario, ticket);
    });
  }

  // Reinicia el SLA desde ahora con las horas de la prioridad
  async reabrir(ticketId, motivo, actor) {
    const ticket = await this._ticketOFallar(ticketId);
    if (!actor.puedeReabrir(ticket)) throw new ErrorDeAcceso('Sin permiso para reabrir este ticket');
    const configuracion = await this.#deps.configuracionSLA.obtenerPorPrioridad(ticket.prioridad.nombre);
    ticket.reabrir(motivo, VentanaSLA.desde(this.#deps.reloj.ahora(), ticket.prioridad.horasDeSLA(configuracion)));
    const reabierto = await this._tickets.actualizar(ticket);
    await this.#deps.auditoria.registrar(new EventoDeAuditoria({ ticketId: ticket.id, actor, accion: 'TICKET_REABIERTO', detalle: { motivo } }));
    return reabierto;
  }
}

module.exports = CicloDeVida;
