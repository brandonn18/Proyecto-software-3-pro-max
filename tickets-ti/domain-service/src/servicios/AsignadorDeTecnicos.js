// Servicio AsignadorDeTecnicos: asignación automática (CP003, delega la
// elección en una EstrategiaDeAsignacion) y manual por un administrador.
const {
  DirectorioDeUsuarios, CanalEnTiempoReal, RepositorioDeAuditoria, ServicioDeCorreo, EstrategiaDeAsignacion,
} = require('../interfaces');
const { ErrorNoEncontrado, ErrorDirectorioNoDisponible } = require('../errores');
const EventoDeAuditoria = require('../entidades/EventoDeAuditoria');
const ServicioDeTickets = require('./ServicioDeTickets');
const Notificador = require('./Notificador');
const MensajesDeNotificacion = require('./MensajesDeNotificacion');
const { Dependencias, TareasEnSegundoPlano } = require('./Dependencias');

class AsignadorDeTecnicos extends ServicioDeTickets {
  #deps;
  #segundoPlano;

  // deps: { tickets, directorio, auditoria, notificador, canal, correo, estrategia, logger? }
  constructor(deps) {
    super(deps?.tickets);
    this.#deps = Dependencias.exigir(deps, {
      directorio: DirectorioDeUsuarios, auditoria: RepositorioDeAuditoria, notificador: Notificador,
      canal: CanalEnTiempoReal, correo: ServicioDeCorreo, estrategia: EstrategiaDeAsignacion,
    });
    this.#segundoPlano = new TareasEnSegundoPlano(deps.logger);
  }

  // Si no hay técnicos o authcore no responde, el ticket queda como estaba:
  // crear un ticket nunca falla por la asignación.
  async asignarAutomaticamente(ticket) {
    const elegido = this.#deps.estrategia.elegir(await this.#candidatos(ticket.categoria));
    if (!elegido) return ticket;
    ticket.asignarA(elegido);
    const asignado = await this._tickets.actualizar(ticket);
    await this.#deps.notificador.notificar({
      usuarioId: elegido.id, ticketId: asignado.id, tipo: 'asignacion',
      mensaje: MensajesDeNotificacion.asignacionAutomatica(asignado), push: false, // ya avisa ticket:nuevo
    });
    this.#deps.canal.emitirATecnico(elegido.id, 'ticket:nuevo', { ticketId: asignado.id, titulo: asignado.titulo });
    return asignado;
  }

  async asignarManualmente(ticketId, tecnicoId, actor) {
    const ticket = await this._ticketOFallar(ticketId);
    const tecnico = await this.#deps.directorio.obtenerUsuario(tecnicoId);
    if (!tecnico?.esTecnicoActivo()) throw new ErrorNoEncontrado('Técnico no encontrado o inactivo');
    ticket.asignarA(tecnico);
    const asignado = await this._tickets.actualizar(ticket);
    await this.#deps.auditoria.registrar(new EventoDeAuditoria({
      ticketId: asignado.id, actor, accion: 'TICKET_ASIGNADO', detalle: { tecnicoId: tecnico.id, tecnicoNombre: tecnico.nombre },
    }));
    await this.#deps.notificador.notificar({
      usuarioId: tecnico.id, ticketId: asignado.id, tipo: 'asignacion', mensaje: MensajesDeNotificacion.asignacion(asignado), push: true,
    });
    this.#segundoPlano.lanzar('Email asignación', () => this.#deps.correo.enviarTicketAsignado(tecnico, asignado));
    return asignado;
  }

  async #candidatos(categoria) {
    const tecnicos = await this.#tecnicosDisponibles();
    return Promise.all(tecnicos.map(async (tecnico) => ({
      tecnico,
      cargaCategoria: await this._tickets.contarCargaActiva({ tecnicoId: tecnico.id, categoria }),
      cargaGlobal: await this._tickets.contarCargaActiva({ tecnicoId: tecnico.id }),
    })));
  }

  async #tecnicosDisponibles() {
    try {
      return await this.#deps.directorio.listarTecnicosActivos();
    } catch (err) {
      if (!(err instanceof ErrorDirectorioNoDisponible)) throw err;
      (this.#deps.logger ?? console).error('[AsignadorDeTecnicos]', 'authcore no disponible; el ticket queda abierto');
      return [];
    }
  }
}

module.exports = AsignadorDeTecnicos;
