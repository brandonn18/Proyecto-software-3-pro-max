// Implementación concreta de RepositorioDeTickets sobre Sequelize (herencia:
// puede reemplazar a la interfaz donde se pida, LSP). Traduce filas ↔ Ticket.
const { Op } = require('sequelize');
const { RepositorioDeTickets } = require('../../interfaces');
const { ErrorIdDuplicado } = require('../../errores');
const Ticket = require('../../entidades/Ticket');
const IdTicket = require('../../valores/IdTicket');
const { ESTADOS_FINALES } = require('../../entidades/estados');

const CAMPOS_MUTABLES = [
  'titulo', 'descripcion', 'tipo', 'categoria', 'prioridad', 'estado', 'tecnicoId', 'tecnico_nombre',
  'reabierto', 'motivo_reapertura', 'sla_limite', 'sla_alerta_enviada',
];
const IGUALDAD = ['estado', 'prioridad', 'tipo', 'categoria', 'tecnicoId', 'usuarioId'];
const NO_FINALES = { [Op.notIn]: ESTADOS_FINALES };

// % y _ son comodines de LIKE: se escapan para que la búsqueda sea literal
const _escaparLike = (texto) => String(texto).replace(/[\\%_]/g, (c) => `\\${c}`);

class RepositorioDeTicketsSequelize extends RepositorioDeTickets {
  #modelo;

  constructor({ Ticket: modelo }) {
    super();
    if (!modelo) throw new Error('RepositorioDeTicketsSequelize requiere el modelo Ticket');
    this.#modelo = modelo;
  }

  static #aEntidad(fila) {
    return fila ? Ticket.reconstruir(fila.get({ plain: true })) : null;
  }

  static #where(filtros) {
    const where = Object.fromEntries(IGUALDAD.filter((c) => filtros[c] !== undefined).map((c) => [c, filtros[c]]));
    if (filtros.fechaDesde || filtros.fechaHasta) {
      where.createdAt = {};
      if (filtros.fechaDesde) where.createdAt[Op.gte] = new Date(filtros.fechaDesde);
      if (filtros.fechaHasta) where.createdAt[Op.lte] = new Date(`${filtros.fechaHasta}T23:59:59`);
    }
    if (filtros.search) {
      const patron = `%${_escaparLike(filtros.search)}%`;
      where[Op.or] = [{ titulo: { [Op.iLike]: patron } }, { id: { [Op.iLike]: patron } }];
    }
    return where;
  }

  async buscarPorId(id) {
    return RepositorioDeTicketsSequelize.#aEntidad(await this.#modelo.findByPk(id));
  }

  // paranoid: false para no reutilizar el ID de un ticket eliminado
  contarDelAnio(anio) {
    return this.#modelo.count({ where: { id: { [Op.like]: `${IdTicket.prefijoDelAnio(anio)}%` } }, paranoid: false });
  }

  async guardarNuevo(ticket) {
    const { createdAt, updatedAt, ...fila } = ticket.aInstantanea();
    try {
      return RepositorioDeTicketsSequelize.#aEntidad(await this.#modelo.create(fila));
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') throw new ErrorIdDuplicado(ticket.id);
      throw err;
    }
  }

  async actualizar(ticket) {
    const fila = ticket.aInstantanea();
    await this.#modelo.update(Object.fromEntries(CAMPOS_MUTABLES.map((c) => [c, fila[c]])), { where: { id: ticket.id } });
    return this.buscarPorId(ticket.id);
  }

  async eliminar(id) {
    await this.#modelo.destroy({ where: { id } });
  }

  async listar({ filtros = {}, paginacion }) {
    const { count, rows } = await this.#modelo.findAndCountAll({
      where: RepositorioDeTicketsSequelize.#where(filtros), order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: paginacion.limit, offset: paginacion.offset,
    });
    return { items: rows.map((f) => RepositorioDeTicketsSequelize.#aEntidad(f)), total: count };
  }

  contarCargaActiva({ tecnicoId, categoria }) {
    const where = { tecnicoId, estado: NO_FINALES };
    if (categoria) where.categoria = categoria;
    return this.#modelo.count({ where });
  }

  async listarPendientesDeAlertaSLA() {
    const filas = await this.#modelo.findAll({
      where: { estado: NO_FINALES, sla_alerta_enviada: false, sla_limite: { [Op.ne]: null }, tecnicoId: { [Op.ne]: null } },
    });
    return filas.map((f) => RepositorioDeTicketsSequelize.#aEntidad(f));
  }
}

module.exports = RepositorioDeTicketsSequelize;
