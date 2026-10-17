// CONTROLADOR de reportes (CP009): junta las cifras del modelo Reporte con
// los técnicos del modelo Usuario y se las pasa a reporteView.
const { manejar } = require('./apoyo');
const respuesta = require('../views/respuesta');
const reporteView = require('../views/reporteView');

const _json = (consulta) => manejar(async (req, res) => res.json(respuesta.exito(await consulta(req))));

// modelos: los de models/index.js (usa Reporte y Usuario)
const crearReportesController = ({ Reporte, Usuario }) => ({
  resumenAdmin: _json(async () => {
    const [conteos, tecnicos] = await Promise.all([Reporte.conteosGenerales(), Usuario.tecnicosActivos()]);
    return reporteView.resumenAdmin(conteos, tecnicos.length);
  }),

  // Incluye técnicos inactivos, igual que el monolito (historial de rendimiento)
  rendimientoTecnicos: _json(async () => {
    const tecnicos = await Usuario.tecnicos({ incluirInactivos: true });
    return Promise.all(tecnicos.map(async (t) => reporteView.rendimientoTecnico(t, await Reporte.metricasTecnico(t.id))));
  }),

  // Agrupa por el snapshot tecnico_nombre: no consulta authcore
  porTecnico: _json(async () => reporteView.porTecnico(await Reporte.conteoPorTecnico())),

  ticketsPorPeriodo: _json((req) => Reporte.ticketsPorPeriodo(req.query.period)),
  cumplimientoSLA: _json(() => Reporte.cumplimientoSLA()),
  dashboardTecnico: _json((req) => Reporte.dashboardTecnico(req.actor.id)),
  resumenUsuario: _json((req) => Reporte.resumenUsuario(req.actor.id)),
  resumenGeneral: _json(() => Reporte.resumenGeneral()),
  estadoSLA: _json(() => Reporte.estadoSLA()),
});

module.exports = { crearReportesController };
