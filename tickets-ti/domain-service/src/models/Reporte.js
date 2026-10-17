// MODELO Reporte: no tiene tabla propia. Agrega cifras de la tabla tickets
// para los reportes (CP009); la forma final del JSON la arma reporteView.
const { Op, fn, col, literal } = require('sequelize');
const { ESTADOS_FINALES } = require('./apoyo/catalogos');
const { servicios } = require('./apoyo/servicios');
const { Ticket } = require('./Ticket');

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
const ACTIVO = { [Op.notIn]: ESTADOS_FINALES };
const FINAL = { [Op.in]: ESTADOS_FINALES };
const HORAS_RESOLUCION = literal('EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 3600');
const PERIODOS = Object.freeze({
  week: { dias: 7, truncar: 'day' },
  month: { dias: 30, truncar: 'day' },
  quarter: { dias: 90, truncar: 'week' },
});

const _ahora = () => servicios.reloj.ahora();
const _vencidos = (ahora, where = {}) => Ticket.count({ where: { ...where, sla_limite: { [Op.lt]: ahora }, estado: ACTIVO } });
const _contarPor = (campo, where = {}) =>
  Ticket.findAll({ attributes: [campo, [fn('COUNT', col('id')), 'total']], where, group: [campo], raw: true });

const _promedioResolucion = async (where = {}) => {
  const [fila] = await Ticket.findAll({ attributes: [[fn('AVG', HORAS_RESOLUCION), 'prom']], where: { ...where, estado: FINAL }, raw: true });
  return parseFloat(fila?.prom || 0).toFixed(1);
};

class Reporte {
  static async conteosGenerales() {
    const ahora = _ahora();
    const [totalTickets, porEstado, porPrioridad, porCategoria, slaVencidos, slaCumplidos, promedioResolucionHoras] = await Promise.all([
      Ticket.count(), _contarPor('estado'), _contarPor('prioridad'), _contarPor('categoria'), _vencidos(ahora),
      Ticket.count({ where: { estado: FINAL, [Op.and]: literal('"updatedAt" <= "sla_limite"') } }),
      _promedioResolucion(),
    ]);
    return { totalTickets, porEstado, porPrioridad, porCategoria, slaVencidos, slaCumplidos, promedioResolucionHoras };
  }

  // periodo: week | month | quarter (cualquier otro valor cuenta como month)
  static ticketsPorPeriodo(periodo = 'month') {
    const { dias, truncar } = PERIODOS[periodo] || PERIODOS.month;
    const agrupado = fn('DATE_TRUNC', truncar, col('createdAt'));
    return Ticket.findAll({
      attributes: [[agrupado, 'periodo'], [fn('COUNT', col('id')), 'total']],
      where: { createdAt: { [Op.gte]: new Date(_ahora().getTime() - dias * DIA_MS) } }, group: [agrupado], order: [[agrupado, 'ASC']], raw: true,
    });
  }

  static async metricasTecnico(tecnicoId) {
    const [asignados, resueltos, slaVencidos, promedioResolucionHoras] = await Promise.all([
      Ticket.count({ where: { tecnicoId } }), Ticket.count({ where: { tecnicoId, estado: FINAL } }),
      _vencidos(_ahora(), { tecnicoId }), _promedioResolucion({ tecnicoId }),
    ]);
    return { asignados, resueltos, slaVencidos, promedioResolucionHoras };
  }

  // El instante se escapa con sequelize.escape (el monolito lo interpolaba sin escapar)
  static async cumplimientoSLA() {
    const instante = Ticket.sequelize.escape(_ahora().toISOString());
    const vencidos = literal(`SUM(CASE WHEN "sla_limite" < ${instante} AND "estado" NOT IN ('resuelto','cerrado') THEN 1 ELSE 0 END)`);
    const agrupar = (campo) => Ticket.findAll({ attributes: [campo, [fn('COUNT', col('id')), 'total'], [vencidos, 'vencidos']], group: [campo], raw: true });
    const [porCategoria, porPrioridad] = await Promise.all([agrupar('categoria'), agrupar('prioridad')]);
    return { porCategoria, porPrioridad };
  }

  static async dashboardTecnico(tecnicoId) {
    const ahora = _ahora();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const [misTickets, porEstado, resueltosSemana, resueltoHoy, slaVencidos, slaEnRiesgo] = await Promise.all([
      Ticket.count({ where: { tecnicoId, estado: ACTIVO } }),
      _contarPor('estado', { tecnicoId }),
      Ticket.count({ where: { tecnicoId, estado: FINAL, updatedAt: { [Op.gte]: new Date(ahora.getTime() - 7 * DIA_MS) } } }),
      Ticket.count({ where: { tecnicoId, estado: FINAL, updatedAt: { [Op.gte]: hoy } } }),
      _vencidos(ahora, { tecnicoId }),
      Ticket.count({ where: { tecnicoId, sla_alerta_enviada: true, estado: ACTIVO } }),
    ]);
    return { misTickets, porEstado, resueltosSemana, resueltoHoy, slaVencidos, slaEnRiesgo };
  }

  static async resumenUsuario(usuarioId) {
    const [total, abiertos, enEspera, resueltos, ultimo] = await Promise.all([
      Ticket.count({ where: { usuarioId } }),
      Ticket.count({ where: { usuarioId, estado: { [Op.in]: ['abierto', 'asignado', 'en_proceso'] } } }),
      Ticket.count({ where: { usuarioId, estado: 'en_espera' } }),
      Ticket.count({ where: { usuarioId, estado: FINAL } }),
      Ticket.findOne({ where: { usuarioId }, order: [['updatedAt', 'DESC']], attributes: ['updatedAt'], raw: true }),
    ]);
    return { total, abiertos, enEspera, resueltos, ultimaActividad: ultimo?.updatedAt || null };
  }

  static async resumenGeneral() {
    const [total, porEstado, porPrioridad] = await Promise.all([Ticket.count(), _contarPor('estado'), _contarPor('prioridad')]);
    return { total, porEstado, porPrioridad };
  }

  static async estadoSLA() {
    const ahora = _ahora();
    const [vencidos, enRiesgo] = await Promise.all([
      _vencidos(ahora),
      Ticket.count({ where: { sla_limite: { [Op.between]: [ahora, new Date(ahora.getTime() + 2 * HORA_MS)] }, estado: ACTIVO } }),
    ]);
    return { vencidos, enRiesgo };
  }

  // MAX(tecnico_nombre): si el snapshot cambió entre tickets, una fila por técnico
  static conteoPorTecnico() {
    return Ticket.findAll({
      attributes: ['tecnicoId', [fn('MAX', col('tecnico_nombre')), 'tecnico_nombre'], [fn('COUNT', col('id')), 'total']],
      group: ['tecnicoId'], raw: true,
    });
  }

  static async estadisticasTiempoReal() {
    const [total, abiertos, enProceso, resueltos, slaVencidos] = await Promise.all([
      Ticket.count(), Ticket.count({ where: { estado: 'abierto' } }), Ticket.count({ where: { estado: 'en_proceso' } }),
      Ticket.count({ where: { estado: 'resuelto' } }), _vencidos(_ahora()),
    ]);
    return { total, abiertos, enProceso, resueltos, slaVencidos };
  }
}

module.exports = { Reporte, PERIODOS };
