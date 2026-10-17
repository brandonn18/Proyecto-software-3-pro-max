// Implementación concreta de RepositorioDeConfiguracionSLA sobre Sequelize.
const { RepositorioDeConfiguracionSLA } = require('../../interfaces');
const ConfiguracionSLA = require('../../entidades/ConfiguracionSLA');

const _aEntidad = (fila) => (fila ? new ConfiguracionSLA(fila.get({ plain: true })) : null);

class RepositorioDeConfiguracionSLASequelize extends RepositorioDeConfiguracionSLA {
  #modelo;

  constructor({ SLAConfig }) {
    super();
    if (!SLAConfig) throw new Error('RepositorioDeConfiguracionSLASequelize requiere el modelo SLAConfig');
    this.#modelo = SLAConfig;
  }

  async obtenerPorPrioridad(prioridad) {
    return _aEntidad(await this.#modelo.findOne({ where: { prioridad } }));
  }

  async buscarPorId(id) {
    return _aEntidad(await this.#modelo.findByPk(id));
  }

  async listar() {
    return (await this.#modelo.findAll({ order: [['tiempo_horas', 'ASC']] })).map(_aEntidad);
  }

  async guardar(configuracion) {
    const { tiempo_horas, porcentaje_alerta } = configuracion.aJSON();
    await this.#modelo.update({ tiempo_horas, porcentaje_alerta }, { where: { id: configuracion.id } });
    return this.buscarPorId(configuracion.id);
  }
}

module.exports = RepositorioDeConfiguracionSLASequelize;
