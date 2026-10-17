const { manejar, ok } = require('./responder');

// sla: slaService (capa de negocio)
const crearSLAController = (sla) => ({
  listar: manejar(async (req, res) => ok(res, await sla.listarConfig())),

  actualizar: manejar(async (req, res) => {
    const { tiempo_horas, porcentaje_alerta } = req.body;
    ok(res, await sla.actualizarConfig(req.params.id, { tiempo_horas, porcentaje_alerta }), 'Configuración SLA actualizada');
  }),
});

module.exports = { crearSLAController };
