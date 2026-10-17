// CONTROLADOR de la configuración de SLA.
const { manejar } = require('./apoyo');
const respuesta = require('../views/respuesta');
const slaView = require('../views/slaView');

// modelos: los de models/index.js (usa SLAConfig)
const crearSLAController = ({ SLAConfig }) => ({
  listar: manejar(async (req, res) => {
    res.json(respuesta.exito((await SLAConfig.listarOrdenado()).map(slaView.config)));
  }),

  actualizar: manejar(async (req, res) => {
    const { tiempo_horas, porcentaje_alerta } = req.body;
    const config = await SLAConfig.actualizarPermitido(req.params.id, { tiempo_horas, porcentaje_alerta });
    res.json(respuesta.exito(slaView.config(config), 'Configuración SLA actualizada'));
  }),
});

module.exports = { crearSLAController };
