// Capa de DATOS: configuración de SLA por prioridad.

const _plano = (fila) => (fila ? fila.get({ plain: true }) : null);

class SLAConfigDAO {
  constructor({ SLAConfig }) {
    if (!SLAConfig) throw new Error('SLAConfigDAO requiere el modelo SLAConfig');
    this.modelo = SLAConfig;
  }

  async obtenerPorPrioridad(prioridad) {
    return _plano(await this.modelo.findOne({ where: { prioridad } }));
  }

  async listar() {
    return (await this.modelo.findAll({ order: [['tiempo_horas', 'ASC']] })).map(_plano);
  }

  // null si no existe
  async actualizar(id, cambios) {
    const config = await this.modelo.findByPk(id);
    if (!config) return null;
    await config.update(cambios);
    return _plano(config);
  }
}

module.exports = { SLAConfigDAO };
