const { ErrorNoImplementado } = require('../errores');

/**
 * Interfaz (clase abstracta) ConsultaDeReportes. Lado de lectura para reportes: agregaciones sobre la tabla de tickets.
 * Las implementaciones la extienden y sobrescriben cada método.
 *
 * conteosGenerales(ahora)               → { totalTickets, porEstado, porPrioridad, porCategoria, slaVencidos, slaCumplidos, promedioResolucionHoras }
 * ticketsPorPeriodo({ desde, truncar }) → [{ periodo, total }]
 * metricasTecnico(tecnicoId, ahora)     → { asignados, resueltos, slaVencidos, promedioResolucionHoras }
 * cumplimientoSLA(ahora)                → { porCategoria, porPrioridad }
 * dashboardTecnico(tecnicoId, ahora)    → { misTickets, porEstado, resueltosSemana, resueltoHoy, slaVencidos, slaEnRiesgo }
 * resumenUsuario(usuarioId)             → { total, abiertos, enEspera, resueltos, ultimaActividad }
 * resumenGeneral()                      → { total, porEstado, porPrioridad }
 * estadoSLA(ahora)                      → { vencidos, enRiesgo }
 * conteoPorTecnico()                    → [{ tecnicoId, tecnico_nombre, total }]
 * estadisticasTiempoReal(ahora)         → { total, abiertos, enProceso, resueltos, slaVencidos }
 */
class ConsultaDeReportes {
  constructor() {
    if (new.target === ConsultaDeReportes) throw new TypeError('ConsultaDeReportes es abstracta');
  }

  async conteosGenerales() { throw new ErrorNoImplementado(this, 'conteosGenerales'); }

  async ticketsPorPeriodo() { throw new ErrorNoImplementado(this, 'ticketsPorPeriodo'); }

  async metricasTecnico() { throw new ErrorNoImplementado(this, 'metricasTecnico'); }

  async cumplimientoSLA() { throw new ErrorNoImplementado(this, 'cumplimientoSLA'); }

  async dashboardTecnico() { throw new ErrorNoImplementado(this, 'dashboardTecnico'); }

  async resumenUsuario() { throw new ErrorNoImplementado(this, 'resumenUsuario'); }

  async resumenGeneral() { throw new ErrorNoImplementado(this, 'resumenGeneral'); }

  async estadoSLA() { throw new ErrorNoImplementado(this, 'estadoSLA'); }

  async conteoPorTecnico() { throw new ErrorNoImplementado(this, 'conteoPorTecnico'); }

  async estadisticasTiempoReal() { throw new ErrorNoImplementado(this, 'estadisticasTiempoReal'); }
}

module.exports = ConsultaDeReportes;
