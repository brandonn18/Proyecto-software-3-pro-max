// Implementación concreta de ConsultaDeReportes: agregaciones de solo lectura
// sobre la tabla tickets. Los técnicos llegan del DirectorioDeUsuarios.
const { Op, fn, col, literal } = require('sequelize');
const { ConsultaDeReportes } = require('../../interfaces');
const { ESTADOS_FINALES } = require('../../entidades/estados');

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
const TRUNCADOS_VALIDOS = ['day', 'week'];
const ACTIVO = { [Op.notIn]: ESTADOS_FINALES };
const FINAL = { [Op.in]: ESTADOS_FINALES };
const HORAS_RESOLUCION = literal('EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 3600');

const _promedio = (valor) => parseFloat(valor || 0).toFixed(1);

class ConsultaDeReportesSequelize extends ConsultaDeReportes {
  #modelo;

  #sequelize;

  constructor({ Ticket }, sequelize) {
    super();
    if (!Ticket || !sequelize) throw new Error('ConsultaDeReportesSequelize requiere el modelo Ticket y la conexión');
    this.#modelo = Ticket;
    this.#sequelize = sequelize;
  }

  #vencidos(ahora, where = {}) {
    return this.#modelo.count({ where: { ...where, sla_limite: { [Op.lt]: ahora }, estado: ACTIVO } });
  }

  #contarPor(campo, where = {}) {
    return this.#modelo.findAll({ attributes: [campo, [fn('COUNT', col('id')), 'total']], where, group: [campo], raw: true });
  }

  async #promedioResolucion(where = {}) {
    const [fila] = await this.#modelo.findAll({
      attributes: [[fn('AVG', HORAS_RESOLUCION), 'prom']], where: { ...where, estado: FINAL }, raw: true,
    });
    return _promedio(fila?.prom);
  }

  async conteosGenerales(ahora) {
    const [totalTickets, porEstado, porPrioridad, porCategoria, slaVencidos, slaCumplidos, promedioResolucionHoras] = await Promise.all([
      this.#modelo.count(), this.#contarPor('estado'), this.#contarPor('prioridad'), this.#contarPor('categoria'),
      this.#vencidos(ahora),
      this.#modelo.count({ where: { estado: FINAL, [Op.and]: literal('"updatedAt" <= "sla_limite"') } }),
      this.#promedioResolucion(),
    ]);
    return { totalTickets, porEstado, porPrioridad, porCategoria, slaVencidos, slaCumplidos, promedioResolucionHoras };
  }

  ticketsPorPeriodo({ desde, truncar }) {
    if (!TRUNCADOS_VALIDOS.includes(truncar)) throw new Error(`truncar inválido: ${truncar}`);
    const periodo = fn('DATE_TRUNC', truncar, col('createdAt'));
    return this.#modelo.findAll({
      attributes: [[periodo, 'periodo'], [fn('COUNT', col('id')), 'total']],
      where: { createdAt: { [Op.gte]: desde } }, group: [periodo], order: [[periodo, 'ASC']], raw: true,
    });
  }

  async metricasTecnico(tecnicoId, ahora) {
    const [asignados, resueltos, slaVencidos, promedioResolucionHoras] = await Promise.all([
      this.#modelo.count({ where: { tecnicoId } }),
      this.#modelo.count({ where: { tecnicoId, estado: FINAL } }),
      this.#vencidos(ahora, { tecnicoId }),
      this.#promedioResolucion({ tecnicoId }),
    ]);
    return { asignados, resueltos, slaVencidos, promedioResolucionHoras };
  }

  // El instante se escapa con sequelize.escape (el monolito lo interpolaba sin escapar)
  async cumplimientoSLA(ahora) {
    const instante = this.#sequelize.escape(ahora.toISOString());
    const vencidos = literal(`SUM(CASE WHEN "sla_limite" < ${instante} AND "estado" NOT IN ('resuelto','cerrado') THEN 1 ELSE 0 END)`);
    const agrupar = (campo) => this.#modelo.findAll({
      attributes: [campo, [fn('COUNT', col('id')), 'total'], [vencidos, 'vencidos']], group: [campo], raw: true,
    });
    const [porCategoria, porPrioridad] = await Promise.all([agrupar('categoria'), agrupar('prioridad')]);
    return { porCategoria, porPrioridad };
  }

  async dashboardTecnico(tecnicoId, ahora) {
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const semana = new Date(ahora.getTime() - 7 * DIA_MS);
    const [misTickets, porEstado, resueltosSemana, resueltoHoy, slaVencidos, slaEnRiesgo] = await Promise.all([
      this.#modelo.count({ where: { tecnicoId, estado: ACTIVO } }),
      this.#contarPor('estado', { tecnicoId }),
      this.#modelo.count({ where: { tecnicoId, estado: FINAL, updatedAt: { [Op.gte]: semana } } }),
      this.#modelo.count({ where: { tecnicoId, estado: FINAL, updatedAt: { [Op.gte]: hoy } } }),
      this.#vencidos(ahora, { tecnicoId }),
      this.#modelo.count({ where: { tecnicoId, sla_alerta_enviada: true, estado: ACTIVO } }),
    ]);
    return { misTickets, porEstado, resueltosSemana, resueltoHoy, slaVencidos, slaEnRiesgo };
  }

  async resumenUsuario(usuarioId) {
    const [total, abiertos, enEspera, resueltos, ultimo] = await Promise.all([
      this.#modelo.count({ where: { usuarioId } }),
      this.#modelo.count({ where: { usuarioId, estado: { [Op.in]: ['abierto', 'asignado', 'en_proceso'] } } }),
      this.#modelo.count({ where: { usuarioId, estado: 'en_espera' } }),
      this.#modelo.count({ where: { usuarioId, estado: FINAL } }),
      this.#modelo.findOne({ where: { usuarioId }, order: [['updatedAt', 'DESC']], attributes: ['updatedAt'], raw: true }),
    ]);
    return { total, abiertos, enEspera, resueltos, ultimaActividad: ultimo?.updatedAt || null };
  }

  async resumenGeneral() {
    const [total, porEstado, porPrioridad] = await Promise.all([this.#modelo.count(), this.#contarPor('estado'), this.#contarPor('prioridad')]);
    return { total, porEstado, porPrioridad };
  }

  async estadoSLA(ahora) {
    const [vencidos, enRiesgo] = await Promise.all([
      this.#vencidos(ahora),
      this.#modelo.count({ where: { sla_limite: { [Op.between]: [ahora, new Date(ahora.getTime() + 2 * HORA_MS)] }, estado: ACTIVO } }),
    ]);
    return { vencidos, enRiesgo };
  }

  // MAX(tecnico_nombre): si el snapshot cambió entre tickets, una fila por técnico
  async conteoPorTecnico() {
    const filas = await this.#modelo.findAll({
      attributes: ['tecnicoId', [fn('MAX', col('tecnico_nombre')), 'tecnico_nombre'], [fn('COUNT', col('id')), 'total']],
      group: ['tecnicoId'], raw: true,
    });
    return filas.map((f) => ({ ...f, total: parseInt(f.total, 10) }));
  }

  async estadisticasTiempoReal(ahora) {
    const [total, abiertos, enProceso, resueltos, slaVencidos] = await Promise.all([
      this.#modelo.count(),
      this.#modelo.count({ where: { estado: 'abierto' } }),
      this.#modelo.count({ where: { estado: 'en_proceso' } }),
      this.#modelo.count({ where: { estado: 'resuelto' } }),
      this.#vencidos(ahora),
    ]);
    return { total, abiertos, enProceso, resueltos, slaVencidos };
  }
}

module.exports = ConsultaDeReportesSequelize;
