const { SLAConfigRepository } = require('../../application/ports');

const _plano = (fila) => (fila ? fila.get({ plain: true }) : null);

class SequelizeSLAConfigRepository extends SLAConfigRepository {
  constructor({ SLAConfig }) {
    super();
    this.modelo = SLAConfig;
  }

  async obtenerPorPrioridad(prioridad) {
    return _plano(await this.modelo.findOne({ where: { prioridad } }));
  }

  async listar() {
    return (await this.modelo.findAll({ order: [['tiempo_horas', 'ASC']] })).map(_plano);
  }

  async actualizar(id, cambios) {
    const config = await this.modelo.findByPk(id);
    if (!config) return null;
    await config.update(cambios);
    return _plano(config);
  }
}

module.exports = SequelizeSLAConfigRepository;
