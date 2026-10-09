const { Op } = require('sequelize');
const { Ticket, catalogos, idTicket } = require('../../domain');
const { TicketRepository } = require('../../application/ports');
const { ErrorIdDuplicado } = require('../../application/errores');

const CAMPOS_MUTABLES = [
  'titulo', 'descripcion', 'tipo', 'categoria', 'prioridad', 'estado', 'tecnicoId', 'tecnico_nombre',
  'reabierto', 'motivo_reapertura', 'sla_limite', 'sla_alerta_enviada',
];
const IGUALDAD = ['estado', 'prioridad', 'tipo', 'categoria', 'tecnicoId', 'usuarioId'];
const NO_FINALES = { [Op.notIn]: catalogos.ESTADOS_FINALES };

// % y _ son comodines de LIKE: se escapan para que la búsqueda sea literal
const _escaparLike = (texto) => String(texto).replace(/[\\%_]/g, (c) => `\\${c}`);

const _rangoFechas = ({ fechaDesde, fechaHasta }) => {
  const rango = {};
  if (fechaDesde) rango[Op.gte] = new Date(fechaDesde);
  if (fechaHasta) rango[Op.lte] = new Date(`${fechaHasta}T23:59:59`);
  return rango;
};

const _construirWhere = (filtros) => {
  const where = Object.fromEntries(IGUALDAD.filter((c) => filtros[c] !== undefined).map((c) => [c, filtros[c]]));
  if (filtros.fechaDesde || filtros.fechaHasta) where.createdAt = _rangoFechas(filtros);
  if (filtros.search) {
    const patron = `%${_escaparLike(filtros.search)}%`;
    where[Op.or] = [{ titulo: { [Op.iLike]: patron } }, { id: { [Op.iLike]: patron } }];
  }
  return where;
};

const _aEntidad = (fila) => (fila ? Ticket.desdePersistencia(fila.get({ plain: true })) : null);

class SequelizeTicketRepository extends TicketRepository {
  constructor({ Ticket: modelo }) {
    super();
    this.modelo = modelo;
  }

  async buscarPorId(id) {
    return _aEntidad(await this.modelo.findByPk(id));
  }

  // paranoid: false para no reutilizar el ID de un ticket eliminado
  contarDelAnio(anio) {
    return this.modelo.count({ where: { id: { [Op.like]: `${idTicket.prefijoDelAnio(anio)}%` } }, paranoid: false });
  }

  async guardarNuevo(ticket) {
    try {
      return _aEntidad(await this.modelo.create(ticket.aPrimitivos()));
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') throw new ErrorIdDuplicado(ticket.id);
      throw err;
    }
  }

  async actualizar(ticket) {
    const datos = ticket.aPrimitivos();
    const cambios = Object.fromEntries(CAMPOS_MUTABLES.map((c) => [c, datos[c]]));
    await this.modelo.update(cambios, { where: { id: ticket.id } });
    return this.buscarPorId(ticket.id);
  }

  async eliminar(id) {
    await this.modelo.destroy({ where: { id } });
  }

  async listar({ filtros = {}, page, limit }) {
    const { count, rows } = await this.modelo.findAndCountAll({
      where: _construirWhere(filtros),
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return { items: rows.map(_aEntidad), total: count };
  }

  contarCargaActiva({ tecnicoId, categoria }) {
    const where = { tecnicoId, estado: NO_FINALES };
    if (categoria) where.categoria = categoria;
    return this.modelo.count({ where });
  }

  async listarPendientesDeAlertaSLA() {
    const filas = await this.modelo.findAll({
      where: {
        estado: NO_FINALES, sla_alerta_enviada: false, sla_limite: { [Op.ne]: null }, tecnicoId: { [Op.ne]: null },
      },
    });
    return filas.map(_aEntidad);
  }
}

module.exports = SequelizeTicketRepository;
