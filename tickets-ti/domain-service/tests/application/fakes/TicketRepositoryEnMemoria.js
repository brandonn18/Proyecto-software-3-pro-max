const { Ticket, catalogos } = require('../../../src/domain');
const { TicketRepository } = require('../../../src/application/ports');
const { ErrorIdDuplicado } = require('../../../src/application/errores');

const _coincideBusqueda = (t, search) => {
  const q = String(search).toLowerCase();
  return t.titulo.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
};

const _coincideFechas = (t, { fechaDesde, fechaHasta }) => {
  if (fechaDesde && t.createdAt < new Date(fechaDesde)) return false;
  if (fechaHasta && t.createdAt > new Date(`${fechaHasta}T23:59:59`)) return false;
  return true;
};

const IGUALDAD = ['estado', 'prioridad', 'tipo', 'categoria', 'tecnicoId', 'usuarioId'];

const _cumpleFiltros = (t, filtros) =>
  IGUALDAD.every((campo) => filtros[campo] === undefined || String(t[campo]) === String(filtros[campo]))
  && (!filtros.search || _coincideBusqueda(t, filtros.search))
  && _coincideFechas(t, filtros);

class TicketRepositoryEnMemoria extends TicketRepository {
  constructor({ clock } = {}) {
    super();
    this.filas = new Map();
    this.eliminados = new Set();
    this.clock = clock;
  }

  _ahora() { return this.clock ? this.clock.ahora() : new Date(0); }

  _vivos() { return [...this.filas.values()].filter((t) => !this.eliminados.has(t.id)); }

  async buscarPorId(id) { return this.eliminados.has(id) ? null : this.filas.get(id) || null; }

  async contarDelAnio(anio) { return [...this.filas.keys()].filter((id) => id.startsWith(`TKT-${anio}-`)).length; }

  async guardarNuevo(ticket) {
    if (this.filas.has(ticket.id)) throw new ErrorIdDuplicado(ticket.id);
    const ahora = this._ahora();
    const guardado = Ticket.desdePersistencia({ ...ticket.aPrimitivos(), createdAt: ahora, updatedAt: ahora });
    this.filas.set(ticket.id, guardado);
    return guardado;
  }

  async actualizar(ticket) {
    const guardado = Ticket.desdePersistencia({ ...ticket.aPrimitivos(), updatedAt: this._ahora() });
    this.filas.set(ticket.id, guardado);
    return guardado;
  }

  async eliminar(id) { this.eliminados.add(id); }

  async listar({ filtros = {}, page, limit }) {
    const todos = this._vivos()
      .filter((t) => _cumpleFiltros(t, filtros))
      .sort((a, b) => (b.createdAt - a.createdAt) || b.id.localeCompare(a.id));
    return { items: todos.slice((page - 1) * limit, page * limit), total: todos.length };
  }

  async contarCargaActiva({ tecnicoId, categoria }) {
    return this._vivos().filter((t) => t.tecnicoId === tecnicoId
      && (!categoria || t.categoria === categoria)
      && !catalogos.ESTADOS_FINALES.includes(t.estado)).length;
  }

  async listarPendientesDeAlertaSLA() {
    return this._vivos().filter((t) => t.estaActivo() && t.tecnicoId && t.sla_limite && !t.sla_alerta_enviada);
  }

  // Helper de test: siembra un ticket tal cual, sin pasar por el caso de uso
  sembrar(props) {
    const t = Ticket.desdePersistencia({ createdAt: this._ahora(), ...props });
    this.filas.set(t.id, t);
    return t;
  }
}

module.exports = TicketRepositoryEnMemoria;
