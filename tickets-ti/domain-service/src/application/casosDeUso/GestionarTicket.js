const { politicaAcceso } = require('../../domain');
const { TicketRepository, AuditoriaRepository } = require('../ports');
const { requerirDependencias, ticketOFallar } = require('../dependencias');
const { normalizarPaginacion, construirMeta } = require('../paginacion');

const FILTROS_PERMITIDOS = ['estado', 'prioridad', 'tipo', 'categoria', 'tecnicoId', 'search', 'fechaDesde', 'fechaHasta'];

const _filtrosDe = (consulta) =>
  Object.fromEntries(FILTROS_PERMITIDOS.filter((f) => consulta[f] !== undefined && consulta[f] !== '').map((f) => [f, consulta[f]]));

// Consultas y ediciones simples sobre un ticket (sin efectos de notificación).
class GestionarTicket {
  constructor(deps) {
    requerirDependencias(deps, { ticketRepository: TicketRepository, auditoria: AuditoriaRepository });
    this.deps = deps;
  }

  // El filtro de rol se aplica después: un usuario no puede pedir tickets ajenos por query
  async listar(consulta, actor) {
    const paginacion = normalizarPaginacion(consulta);
    const filtros = { ..._filtrosDe(consulta), ...politicaAcceso.filtroDeListado(actor) };
    const { items, total } = await this.deps.ticketRepository.listar({ filtros, ...paginacion });
    return { items, meta: construirMeta(total, paginacion) };
  }

  async obtener(ticketId, actor) {
    const ticket = await ticketOFallar(this.deps.ticketRepository, ticketId);
    politicaAcceso.exigirVer(ticket, actor);
    const auditorias = await this.deps.auditoria.listarPorTicket(ticket.id);
    return { ticket, auditorias };
  }

  async actualizarDatos(ticketId, cambios) {
    const ticket = await ticketOFallar(this.deps.ticketRepository, ticketId);
    return this.deps.ticketRepository.actualizar(ticket.actualizarDatos(cambios));
  }

  async eliminar(ticketId) {
    await ticketOFallar(this.deps.ticketRepository, ticketId);
    await this.deps.ticketRepository.eliminar(ticketId);
  }
}

module.exports = GestionarTicket;
