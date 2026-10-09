const { definirPuerto } = require('./definirPuerto');

/**
 * Lado de lectura para reportes: agregaciones sobre la tabla de tickets.
 * No conoce usuarios; los técnicos llegan por UserDirectoryPort.
 *
 * conteosGenerales(ahora) → { totalTickets, porEstado: [{estado,total}], porPrioridad, porCategoria,
 *                             slaVencidos, slaCumplidos, promedioResolucionHoras }
 * ticketsPorPeriodo({ desde, truncar })  → [{ periodo, total }]
 * metricasTecnico(tecnicoId, ahora)      → { asignados, resueltos, slaVencidos, promedioResolucionHoras }
 * cumplimientoSLA(ahora)                 → { porCategoria, porPrioridad }
 * dashboardTecnico(tecnicoId, ahora)     → { misTickets, porEstado, resueltosSemana, resueltoHoy, slaVencidos, slaEnRiesgo }
 * resumenUsuario(usuarioId)              → { total, abiertos, enEspera, resueltos, ultimaActividad }
 * resumenGeneral()                       → { total, porEstado, porPrioridad }
 * estadoSLA(ahora)                       → { vencidos, enRiesgo }
 * conteoPorTecnico()                     → [{ tecnicoId, tecnico_nombre, total }]
 * estadisticasTiempoReal(ahora)          → { total, abiertos, enProceso, resueltos, slaVencidos }
 */
module.exports = definirPuerto('ReportesQueryPort', [
  'conteosGenerales', 'ticketsPorPeriodo', 'metricasTecnico', 'cumplimientoSLA', 'dashboardTecnico',
  'resumenUsuario', 'resumenGeneral', 'estadoSLA', 'conteoPorTecnico', 'estadisticasTiempoReal',
]);
