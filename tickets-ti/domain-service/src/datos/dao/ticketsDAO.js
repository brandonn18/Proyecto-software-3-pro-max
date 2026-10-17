// Capa de DATOS: acceso a la tabla tickets. Recibe y devuelve objetos planos;
// no decide reglas de negocio (qué estado sigue, quién puede qué).
const { Op } = require('sequelize');
const { ESTADOS_FINALES } = require('../../comun/catalogos');
const { ErrorIdDuplicado } = require('../../comun/errores');

const CAMPOS_MUTABLES = [
  'titulo', 'descripcion', 'tipo', 'categoria', 'prioridad', 'estado', 'tecnicoId', 'tecnico_nombre',
  'reabierto', 'motivo_reapertura', 'sla_limite', 'sla_alerta_enviada',
];
const IGUALDAD = ['estado', 'prioridad', 'tipo', 'categoria', 'tecnicoId', 'usuarioId'];
const NO_FINALES = { [Op.notIn]: ESTADOS_FINALES };

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

const _plano = (fila) => (fila ? fila.get({ plain: true }) : null);

class TicketsDAO {
  // Ticket: modelo Sequelize de datos/modelos.js
  constructor({ Ticket }) {
    if (!Ticket) throw new Error('TicketsDAO requiere el modelo Ticket');
    this.modelo = Ticket;
  }

  async buscarPorId(id) {
    return _plano(await this.modelo.findByPk(id));
  }

  // paranoid: false para no reutilizar el ID de un ticket eliminado
  contarDelAnio(anio) {
    return this.modelo.count({ where: { id: { [Op.like]: `TKT-${anio}-%` } }, paranoid: false });
  }

  async insertar(fila) {
    try {
      return _plano(await this.modelo.create(fila));
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') throw new ErrorIdDuplicado(fila.id);
      throw err;
    }
  }

  // cambios: solo columnas de CAMPOS_MUTABLES; el resto se ignora
  async actualizar(id, cambios) {
    const permitidos = Object.fromEntries(Object.entries(cambios).filter(([c]) => CAMPOS_MUTABLES.includes(c)));
    await this.modelo.update(permitidos, { where: { id } });
    return this.buscarPorId(id);
  }

  async eliminar(id) {
    await this.modelo.destroy({ where: { id } });
  }

  async listar({ filtros = {}, page, limit }) {
    const { count, rows } = await this.modelo.findAndCountAll({
      where: _construirWhere(filtros), order: [['createdAt', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit,
    });
    return { items: rows.map(_plano), total: count };
  }

  contarCargaActiva({ tecnicoId, categoria }) {
    const where = { tecnicoId, estado: NO_FINALES };
    if (categoria) where.categoria = categoria;
    return this.modelo.count({ where });
  }

  async listarPendientesDeAlertaSLA() {
    const filas = await this.modelo.findAll({
      where: { estado: NO_FINALES, sla_alerta_enviada: false, sla_limite: { [Op.ne]: null }, tecnicoId: { [Op.ne]: null } },
    });
    return filas.map(_plano);
  }
}

module.exports = { TicketsDAO, CAMPOS_MUTABLES };
