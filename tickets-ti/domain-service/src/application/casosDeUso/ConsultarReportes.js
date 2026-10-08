const { ReportesQueryPort, UserDirectoryPort, Clock } = require('../ports');
const { requerirDependencias } = require('../dependencias');

const DIA_MS = 24 * 60 * 60 * 1000;
const PERIODOS = Object.freeze({
  week: { dias: 7, truncar: 'day' },
  month: { dias: 30, truncar: 'day' },
  quarter: { dias: 90, truncar: 'week' },
});

const _estadoMap = (porEstado) => Object.fromEntries(porEstado.map((e) => [e.estado, parseInt(e.total, 10)]));

// Reportes y dashboards (CP009). Las cifras de tickets salen de
// ReportesQueryPort; los técnicos, del directorio de authcore.
class ConsultarReportes {
  constructor(deps) {
    requerirDependencias(deps, { reportes: ReportesQueryPort, userDirectory: UserDirectoryPort, clock: Clock });
    this.deps = deps;
  }

  async resumenAdmin() {
    const [conteos, tecnicos] = await Promise.all([
      this.deps.reportes.conteosGenerales(this.deps.clock.ahora()),
      this.deps.userDirectory.listarTecnicosActivos(),
    ]);
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
    const desde = new Date(this.deps.clock.ahora().getTime() - dias * DIA_MS);
    return this.deps.reportes.ticketsPorPeriodo({ desde, truncar });
  }

  // Incluye técnicos inactivos, igual que el monolito (historial de rendimiento)
  async rendimientoTecnicos() {
    const ahora = this.deps.clock.ahora();
    const tecnicos = await this.deps.userDirectory.listarTecnicos({ incluirInactivos: true });
    return Promise.all(tecnicos.map(async (t) => {
      const m = await this.deps.reportes.metricasTecnico(t.id, ahora);
      return {
        tecnicoId: t.id, nombre: t.nombre, email: t.email,
        ticketsAsignados: m.asignados, ticketsResueltos: m.resueltos,
        promedioResolucionHoras: m.promedioResolucionHoras,
        slasCumplidos: m.resueltos, slasVencidos: m.slaVencidos,
      };
    }));
  }

  cumplimientoSLA() { return this.deps.reportes.cumplimientoSLA(this.deps.clock.ahora()); }

  dashboardTecnico(actor) { return this.deps.reportes.dashboardTecnico(actor.id, this.deps.clock.ahora()); }

  resumenUsuario(actor) { return this.deps.reportes.resumenUsuario(actor.id); }

  resumenGeneral() { return this.deps.reportes.resumenGeneral(); }

  estadoSLA() { return this.deps.reportes.estadoSLA(this.deps.clock.ahora()); }

  // Agrupa por el snapshot tecnico_nombre: no consulta authcore
  async porTecnico() {
    const filas = await this.deps.reportes.conteoPorTecnico();
    return filas.map((f) => ({
      tecnicoId: f.tecnicoId,
      total: String(f.total),
      tecnico: f.tecnicoId ? { nombre: f.tecnico_nombre } : null,
    }));
  }
}

module.exports = ConsultarReportes;
