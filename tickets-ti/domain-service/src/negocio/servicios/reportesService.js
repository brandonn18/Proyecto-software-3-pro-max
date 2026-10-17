// Capa de NEGOCIO: reportes y dashboards (CP009). Las cifras de tickets salen
// de ReportesDAO; los técnicos, del directorio de authcore.

const DIA_MS = 24 * 60 * 60 * 1000;
const PERIODOS = Object.freeze({
  week: { dias: 7, truncar: 'day' },
  month: { dias: 30, truncar: 'day' },
  quarter: { dias: 90, truncar: 'week' },
});

const _estadoMap = (porEstado) => Object.fromEntries(porEstado.map((e) => [e.estado, parseInt(e.total, 10)]));

class ReportesService {
  // deps: { dao, directorio, tiempoReal, reloj }
  constructor(deps) {
    this.deps = deps;
    this.reportes = deps.dao.reportes;
  }

  _ahora() {
    return this.deps.reloj.ahora();
  }

  async resumenAdmin() {
    const [conteos, tecnicos] = await Promise.all([this.reportes.conteosGenerales(this._ahora()), this.deps.directorio.listarTecnicosActivos()]);
    const e = _estadoMap(conteos.porEstado);
    return {
      totalTickets: conteos.totalTickets,
      abiertos: e.abierto || 0, asignados: e.asignado || 0, enProceso: e.en_proceso || 0,
      enEspera: e.en_espera || 0, resueltos: e.resuelto || 0, cerrados: e.cerrado || 0,
      promedioResolucionHoras: conteos.promedioResolucionHoras,
      ticketsPorPrioridad: conteos.porPrioridad,
      ticketsPorCategoria: conteos.porCategoria,
      tecnicosActivos: tecnicos.length,
      slaVencidos: conteos.slaVencidos,
      slaCumplidos: conteos.slaCumplidos,
    };
  }

  ticketsPorPeriodo(periodo = 'month') {
    const { dias, truncar } = PERIODOS[periodo] || PERIODOS.month;
    return this.reportes.ticketsPorPeriodo({ desde: new Date(this._ahora().getTime() - dias * DIA_MS), truncar });
  }

  // Incluye técnicos inactivos, igual que el monolito (historial de rendimiento)
  async rendimientoTecnicos() {
    const ahora = this._ahora();
    const tecnicos = await this.deps.directorio.listarTecnicos({ incluirInactivos: true });
    return Promise.all(tecnicos.map(async (t) => {
      const m = await this.reportes.metricasTecnico(t.id, ahora);
      return {
        tecnicoId: t.id, nombre: t.nombre, email: t.email, ticketsAsignados: m.asignados, ticketsResueltos: m.resueltos,
        promedioResolucionHoras: m.promedioResolucionHoras, slasCumplidos: m.resueltos, slasVencidos: m.slaVencidos,
      };
    }));
  }

  cumplimientoSLA() { return this.reportes.cumplimientoSLA(this._ahora()); }

  dashboardTecnico(actor) { return this.reportes.dashboardTecnico(actor.id, this._ahora()); }

  resumenUsuario(actor) { return this.reportes.resumenUsuario(actor.id); }

  resumenGeneral() { return this.reportes.resumenGeneral(); }

  estadoSLA() { return this.reportes.estadoSLA(this._ahora()); }

  // Agrupa por el snapshot tecnico_nombre: no consulta authcore
  async porTecnico() {
    return (await this.reportes.conteoPorTecnico()).map((f) => ({
      tecnicoId: f.tecnicoId, total: String(f.total), tecnico: f.tecnicoId ? { nombre: f.tecnico_nombre } : null,
    }));
  }

  // Lo dispara el cron cada 5 min: empuja las cifras del dashboard a los admins
  async publicarEstadisticas() {
    const [stats, tecnicos] = await Promise.all([this.reportes.estadisticasTiempoReal(this._ahora()), this.deps.directorio.listarTecnicosActivos()]);
    const datos = { ...stats, tecnicosActivos: tecnicos.length };
    this.deps.tiempoReal.emitirAAdmins('estadisticas:actualizadas', datos);
    return datos;
  }
}

module.exports = { ReportesService };
