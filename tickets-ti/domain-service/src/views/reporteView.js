// VISTA: forma del JSON de los reportes (contrato del frontend, CP009).

const _porEstado = (filas) => Object.fromEntries(filas.map((e) => [e.estado, parseInt(e.total, 10)]));

// conteos: Reporte.conteosGenerales() | tecnicosActivos: cantidad del directorio
const resumenAdmin = (conteos, tecnicosActivos) => {
  const e = _porEstado(conteos.porEstado);
  return {
    totalTickets: conteos.totalTickets,
    abiertos: e.abierto || 0, asignados: e.asignado || 0, enProceso: e.en_proceso || 0,
    enEspera: e.en_espera || 0, resueltos: e.resuelto || 0, cerrados: e.cerrado || 0,
    promedioResolucionHoras: conteos.promedioResolucionHoras,
    ticketsPorPrioridad: conteos.porPrioridad,
    ticketsPorCategoria: conteos.porCategoria,
    tecnicosActivos,
    slaVencidos: conteos.slaVencidos,
    slaCumplidos: conteos.slaCumplidos,
  };
};

// tecnico: persona del directorio | m: Reporte.metricasTecnico()
const rendimientoTecnico = (tecnico, m) => ({
  tecnicoId: tecnico.id, nombre: tecnico.nombre, email: tecnico.email,
  ticketsAsignados: m.asignados, ticketsResueltos: m.resueltos,
  promedioResolucionHoras: m.promedioResolucionHoras,
  slasCumplidos: m.resueltos, slasVencidos: m.slaVencidos,
});

const porTecnico = (filas) => filas.map((f) => ({
  tecnicoId: f.tecnicoId,
  total: String(f.total),
  tecnico: f.tecnicoId ? { nombre: f.tecnico_nombre } : null,
}));

// Lo que reciben los admins por Socket.io ('estadisticas:actualizadas')
const estadisticas = (stats, tecnicosActivos) => ({ ...stats, tecnicosActivos });

module.exports = { resumenAdmin, rendimientoTecnico, porTecnico, estadisticas };
