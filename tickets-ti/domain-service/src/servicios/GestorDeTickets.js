// Servicio GestorDeTickets: alta (CP001), consulta, edición y baja.
const { RepositorioDeConfiguracionSLA, RepositorioDeAuditoria, Reloj } = require('../interfaces');
const { ErrorDeAcceso, ErrorIdDuplicado } = require('../errores');
const Ticket = require('../entidades/Ticket');
const EventoDeAuditoria = require('../entidades/EventoDeAuditoria');
const IdTicket = require('../valores/IdTicket');
const DatosDeTicket = require('../valores/DatosDeTicket');
const VentanaSLA = require('../valores/VentanaSLA');
const Paginacion = require('../valores/Paginacion');
const ServicioDeTickets = require('./ServicioDeTickets');
const AsignadorDeTecnicos = require('./AsignadorDeTecnicos');
const Notificador = require('./Notificador');
const MensajesDeNotificacion = require('./MensajesDeNotificacion');
const { Dependencias } = require('./Dependencias');

const MAX_REINTENTOS_ID = 10;
const FILTROS_PERMITIDOS = ['estado', 'prioridad', 'tipo', 'categoria', 'tecnicoId', 'search', 'fechaDesde', 'fechaHasta'];

class GestorDeTickets extends ServicioDeTickets {
  #deps;

  // deps: { tickets, configuracionSLA, auditoria, notificador, asignador, reloj }
  constructor(deps) {
    super(deps?.tickets);
    this.#deps = Dependencias.exigir(deps, {
      configuracionSLA: RepositorioDeConfiguracionSLA, auditoria: RepositorioDeAuditoria,
      notificador: Notificador, asignador: AsignadorDeTecnicos, reloj: Reloj,
    });
  }

  // datos: { titulo, descripcion, tipo, categoria, prioridad? } | actor: Actor
  async abrir(datos, actor) {
    const datosValidos = new DatosDeTicket(datos);
    const configuracion = await this.#deps.configuracionSLA.obtenerPorPrioridad(datosValidos.prioridad.nombre);
    const ahora = this.#deps.reloj.ahora();
    const ventana = VentanaSLA.desde(ahora, datosValidos.prioridad.horasDeSLA(configuracion));
    const ticket = await this.#guardarConIdUnico(ahora.getFullYear(), { datos: datosValidos, solicitante: actor, ventanaSLA: ventana });
    await this.#deps.auditoria.registrar(new EventoDeAuditoria({
      ticketId: ticket.id, actor, accion: 'TICKET_CREADO',
      detalle: { titulo: ticket.titulo, categoria: ticket.categoria, prioridad: ticket.prioridad.nombre },
    }));
    await this.#deps.notificador.notificar({
      usuarioId: actor.id, ticketId: ticket.id, tipo: 'creacion', mensaje: MensajesDeNotificacion.creacion(ticket), push: false,
    });
    return this.#deps.asignador.asignarAutomaticamente(ticket);
  }

  // Reintenta con el siguiente correlativo ante colisión por creación concurrente
  async #guardarConIdUnico(anio, propiedades) {
    for (let intento = 0; intento <= MAX_REINTENTOS_ID; intento++) {
      const correlativo = (await this._tickets.contarDelAnio(anio)) + 1 + intento;
      try {
        return await this._tickets.guardarNuevo(Ticket.abrir({ ...propiedades, id: IdTicket.del(anio, correlativo) }));
      } catch (err) {
        if (!(err instanceof ErrorIdDuplicado)) throw err;
      }
    }
    throw new Error(`No se pudo generar un ID único tras ${MAX_REINTENTOS_ID} reintentos`);
  }

  // El filtro del actor se aplica al final: un usuario no puede pedir tickets ajenos por query
  async listar(consulta, actor) {
    const paginacion = new Paginacion(consulta);
    const propios = Object.fromEntries(FILTROS_PERMITIDOS.filter((f) => consulta[f] !== undefined && consulta[f] !== '').map((f) => [f, consulta[f]]));
    const { items, total } = await this._tickets.listar({ filtros: { ...propios, ...actor.filtroDeListado() }, paginacion });
    return { items, meta: paginacion.meta(total) };
  }

  async detalle(ticketId, actor) {
    const ticket = await this._ticketOFallar(ticketId);
    if (!actor.puedeVer(ticket)) throw new ErrorDeAcceso('Sin acceso a este ticket');
    return { ticket, historial: await this.#deps.auditoria.listarPorTicket(ticket.id) };
  }

  async actualizarDatos(ticketId, cambios) {
    const ticket = await this._ticketOFallar(ticketId);
    ticket.actualizarDatos(cambios);
    return this._tickets.actualizar(ticket);
  }

  async eliminar(ticketId) {
    const ticket = await this._ticketOFallar(ticketId);
    await this._tickets.eliminar(ticket.id);
  }
}

module.exports = GestorDeTickets;
