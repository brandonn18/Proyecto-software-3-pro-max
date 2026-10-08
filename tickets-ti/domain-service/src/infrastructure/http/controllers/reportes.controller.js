const { manejar, ok } = require('./manejar');

// reportes: caso de uso ConsultarReportes
const crearReportesController = (reportes) => ({
  resumenAdmin: manejar(async (req, res) => ok(res, await reportes.resumenAdmin())),
  ticketsPorPeriodo: manejar(async (req, res) => ok(res, await reportes.ticketsPorPeriodo(req.query.period))),
  rendimientoTecnicos: manejar(async (req, res) => ok(res, await reportes.rendimientoTecnicos())),
  cumplimientoSLA: manejar(async (req, res) => ok(res, await reportes.cumplimientoSLA())),
  dashboardTecnico: manejar(async (req, res) => ok(res, await reportes.dashboardTecnico(req.actor))),
  resumenUsuario: manejar(async (req, res) => ok(res, await reportes.resumenUsuario(req.actor))),
  resumenGeneral: manejar(async (req, res) => ok(res, await reportes.resumenGeneral())),
  estadoSLA: manejar(async (req, res) => ok(res, await reportes.estadoSLA())),
  porTecnico: manejar(async (req, res) => ok(res, await reportes.porTecnico())),
});

module.exports = { crearReportesController };
