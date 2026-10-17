const ControladorBase = require('./ControladorBase');
const GestorDeConfiguracionSLA = require('../../servicios/GestorDeConfiguracionSLA');

class ControladorDeSLA extends ControladorBase {
  #gestor;

  constructor(gestor) {
    super();
    if (!(gestor instanceof GestorDeConfiguracionSLA)) throw new TypeError('ControladorDeSLA requiere un GestorDeConfiguracionSLA');
    this.#gestor = gestor;
  }

  listar = this.accion(async (req, res) => {
    this.responder(res, (await this.#gestor.listar()).map((c) => c.aJSON()));
  });

  actualizar = this.accion(async (req, res) => {
    const { tiempo_horas, porcentaje_alerta } = req.body;
    const configuracion = await this.#gestor.ajustar(req.params.id, { tiempo_horas, porcentaje_alerta });
    this.responder(res, configuracion.aJSON(), 'Configuración SLA actualizada');
  });
}

module.exports = ControladorDeSLA;
