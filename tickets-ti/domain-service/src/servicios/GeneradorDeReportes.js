// Servicio GeneradorDeReportes (CP009): las cifras salen de ConsultaDeReportes
// y los técnicos del DirectorioDeUsuarios.
const { ConsultaDeReportes, DirectorioDeUsuarios, CanalEnTiempoReal, Reloj } = require('../interfaces');
const { Dependencias } = require('./Dependencias');

const DIA_MS = 24 * 60 * 60 * 1000;
const PERIODOS = Object.freeze({
  week: { dias: 7, truncar: 'day' },
  month: { dias: 30, truncar: 'day' },
  quarter: { dias: 90, truncar: 'week' },
});

const _porEstado = (filas) => Object.fromEntries(filas.map((e) => [e.estado, parseInt(e.total, 10)]));

class GeneradorDeReportes {
  #consulta;
  #directorio;
  #canal;
  #reloj;

  constructor(deps) {
    Dependencias.exigir(deps, { consulta: ConsultaDeReportes, directorio: DirectorioDeUsuarios, canal: CanalEnTiempoReal, reloj: Reloj });
    this.#consulta = deps.consulta;
    this.#directorio = deps.directorio;
    this.#canal = deps.canal;
    this.#reloj = deps.reloj;
  }

  async resumenAdmin() {
    const [conteos, tecnicos] = await Promise.all([this.#consulta.conteosGenerales(this.#reloj.ahora()), this.#directorio.listarTecnicosActivos()]);
    const e = _porEstado(conteos.porEstado);
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
    return this.#consulta.ticketsPorPeriodo({ desde: new Date(this.#reloj.ahora().getTime() - dias * DIA_MS), truncar });
  }

  // Incluye técnicos inactivos, igual que el monolito (historial de rendimiento)
  async rendimientoTecnicos() {
    const ahora = this.#reloj.ahora();
    const tecnicos = await this.#directorio.listarTecnicos({ incluirInactivos: true });
    return Promise.all(tecnicos.map(async (t) => {
      const m = await this.#consulta.metricasTecnico(t.id, ahora);
      return {
        tecnicoId: t.id, nombre: t.nombre, email: t.email, ticketsAsignados: m.asignados, ticketsResueltos: m.resueltos,
        promedioResolucionHoras: m.promedioResolucionHoras, slasCumplidos: m.resueltos, slasVencidos: m.slaVencidos,
      };
    }));
  }

  cumplimientoSLA() { return this.#consulta.cumplimientoSLA(this.#reloj.ahora()); }

  dashboardTecnico(actor) { return this.#consulta.dashboardTecnico(actor.id, this.#reloj.ahora()); }

  resumenUsuario(actor) { return this.#consulta.resumenUsuario(actor.id); }

  resumenGeneral() { return this.#consulta.resumenGeneral(); }

  estadoSLA() { return this.#consulta.estadoSLA(this.#reloj.ahora()); }

  // Agrupa por el snapshot tecnico_nombre: no consulta authcore
  async porTecnico() {
    return (await this.#consulta.conteoPorTecnico()).map((f) => ({
      tecnicoId: f.tecnicoId, total: String(f.total), tecnico: f.tecnicoId ? { nombre: f.tecnico_nombre } : null,
    }));
  }

  // Lo dispara el cron cada 5 min: empuja las cifras del dashboard a los admins
  async publicarEstadisticas() {
    const [stats, tecnicos] = await Promise.all([this.#consulta.estadisticasTiempoReal(this.#reloj.ahora()), this.#directorio.listarTecnicosActivos()]);
    const datos = { ...stats, tecnicosActivos: tecnicos.length };
    this.#canal.emitirAAdmins('estadisticas:actualizadas', datos);
    return datos;
  }
}

module.exports = GeneradorDeReportes;
