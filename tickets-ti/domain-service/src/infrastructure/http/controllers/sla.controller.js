const { manejar, ok } = require('./manejar');

// slaConfig: caso de uso GestionarSLAConfig
const crearSLAController = (slaConfig) => ({
  listar: manejar(async (req, res) => ok(res, await slaConfig.listar())),

  actualizar: manejar(async (req, res) => {
    const { tiempo_horas, porcentaje_alerta } = req.body;
    const config = await slaConfig.actualizar(req.params.id, { tiempo_horas, porcentaje_alerta });
    ok(res, config, 'Configuración SLA actualizada');
  }),
});

module.exports = { crearSLAController };
