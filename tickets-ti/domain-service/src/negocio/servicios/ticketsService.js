// Capa de NEGOCIO: alta, consulta, edición y baja de tickets.
const { ErrorIdDuplicado } = require('../../comun/errores');
const idTicket = require('../reglas/idTicket');
const politicaSLA = require('../reglas/politicaSLA');
const politicaAcceso = require('../reglas/politicaAcceso');
const { nuevoTicket, cambiosEditables } = require('../reglas/reglasTicket');
const { normalizarPaginacion, construirMeta } = require('../reglas/paginacion');
const mensajes = require('../reglas/mensajes');
const { ticketOFallar } = require('./apoyo');

const MAX_REINTENTOS_ID = 10;
const FILTROS_PERMITIDOS = ['estado', 'prioridad', 'tipo', 'categoria', 'tecnicoId', 'search', 'fechaDesde', 'fechaHasta'];

const _filtrosDe = (consulta) =>
  Object.fromEntries(FILTROS_PERMITIDOS.filter((f) => consulta[f] !== undefined && consulta[f] !== '').map((f) => [f, consulta[f]]));

class TicketsService {
  // deps: { dao, asignacion (servicio), notificaciones (servicio), reloj }
  constructor(deps) {
    this.deps = deps;
    this.dao = deps.dao;
  }

  // CP001: ID correlativo, SLA según prioridad, auditoría, aviso al creador y CP003
  async crear(datos, actor) {
    const prioridad = datos.prioridad || 'media';
    const config = await this.dao.slaConfig.obtenerPorPrioridad(prioridad);
    const sla = { ahora: this.deps.reloj.ahora(), horas: politicaSLA.horasPara(prioridad, config) };
    const ticket = await this._insertarConIdUnico({ ...datos, prioridad, creador: actor }, sla);
    await this._registrarCreacion(ticket, actor);
    return this.deps.asignacion.automatica(ticket);
  }

  // Reintenta con el siguiente correlativo ante colisión por creación concurrente
  async _insertarConIdUnico(datos, sla) {
    const anio = sla.ahora.getFullYear();
    for (let intento = 0; intento <= MAX_REINTENTOS_ID; intento++) {
      const correlativo = (await this.dao.tickets.contarDelAnio(anio)) + 1 + intento;
      const fila = nuevoTicket({ ...datos, id: idTicket.formatear(anio, correlativo) }, sla);
      try {
        return await this.dao.tickets.insertar(fila);
      } catch (err) {
        if (!(err instanceof ErrorIdDuplicado)) throw err;
      }
    }
    throw new Error(`No se pudo generar un ID único tras ${MAX_REINTENTOS_ID} reintentos`);
  }

  async _registrarCreacion(ticket, actor) {
    await this.dao.auditoria.registrar({
      ticketId: ticket.id, actor, accion: 'TICKET_CREADO',
      detalle: { titulo: ticket.titulo, categoria: ticket.categoria, prioridad: ticket.prioridad },
    });
    await this.deps.notificaciones.notificar({
      usuarioId: actor.id, ticketId: ticket.id, tipo: 'creacion', mensaje: mensajes.creacion(ticket), push: false,
    });
  }

  // El filtro de rol se aplica después: un usuario no puede pedir tickets ajenos por query
  async listar(consulta, actor) {
    const paginacion = normalizarPaginacion(consulta);
    const filtros = { ..._filtrosDe(consulta), ...politicaAcceso.filtroDeListado(actor) };
    const { items, total } = await this.dao.tickets.listar({ filtros, ...paginacion });
    return { items, meta: construirMeta(total, paginacion) };
  }

  async obtener(ticketId, actor) {
    const ticket = await ticketOFallar(this.dao.tickets, ticketId);
    politicaAcceso.exigirVer(ticket, actor);
    return { ticket, auditorias: await this.dao.auditoria.listarPorTicket(ticket.id) };
  }

  async actualizarDatos(ticketId, cambios) {
    const ticket = await ticketOFallar(this.dao.tickets, ticketId);
    return this.dao.tickets.actualizar(ticket.id, cambiosEditables(ticket, cambios));
  }

  async eliminar(ticketId) {
    await ticketOFallar(this.dao.tickets, ticketId);
    await this.dao.tickets.eliminar(ticketId);
  }
}

module.exports = { TicketsService, MAX_REINTENTOS_ID };
