const { ErrorNoImplementado } = require('../errores');

/**
 * Interfaz (clase abstracta) RepositorioDeConfiguracionSLA. Configuración de SLA por prioridad.
 * Las implementaciones la extienden y sobrescriben cada método.
 *
 * obtenerPorPrioridad(prioridad) → Promise<ConfiguracionSLA|null>
 * buscarPorId(id)                → Promise<ConfiguracionSLA|null>
 * listar()                       → Promise<ConfiguracionSLA[]>  orden: tiempo_horas ASC
 * guardar(configuracion)         → Promise<ConfiguracionSLA>
 */
class RepositorioDeConfiguracionSLA {
  constructor() {
    if (new.target === RepositorioDeConfiguracionSLA) throw new TypeError('RepositorioDeConfiguracionSLA es abstracta');
  }

  async obtenerPorPrioridad() { throw new ErrorNoImplementado(this, 'obtenerPorPrioridad'); }

  async buscarPorId() { throw new ErrorNoImplementado(this, 'buscarPorId'); }

  async listar() { throw new ErrorNoImplementado(this, 'listar'); }

  async guardar() { throw new ErrorNoImplementado(this, 'guardar'); }
}

module.exports = RepositorioDeConfiguracionSLA;
