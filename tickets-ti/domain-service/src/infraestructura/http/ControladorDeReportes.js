const ControladorBase = require('./ControladorBase');
const GeneradorDeReportes = require('../../servicios/GeneradorDeReportes');

class ControladorDeReportes extends ControladorBase {
  #reportes;

  constructor(reportes) {
    super();
    if (!(reportes instanceof GeneradorDeReportes)) throw new TypeError('ControladorDeReportes requiere un GeneradorDeReportes');
    this.#reportes = reportes;
  }

  #json(consulta) {
    return this.accion(async (req, res) => this.responder(res, await consulta(req)));
  }

  resumenAdmin = this.#json(() => this.#reportes.resumenAdmin());

  ticketsPorPeriodo = this.#json((req) => this.#reportes.ticketsPorPeriodo(req.query.period));

  rendimientoTecnicos = this.#json(() => this.#reportes.rendimientoTecnicos());

  cumplimientoSLA = this.#json(() => this.#reportes.cumplimientoSLA());

  dashboardTecnico = this.#json((req) => this.#reportes.dashboardTecnico(req.actor));

  resumenUsuario = this.#json((req) => this.#reportes.resumenUsuario(req.actor));

  resumenGeneral = this.#json(() => this.#reportes.resumenGeneral());

  estadoSLA = this.#json(() => this.#reportes.estadoSLA());

  porTecnico = this.#json(() => this.#reportes.porTecnico());
}

module.exports = ControladorDeReportes;
