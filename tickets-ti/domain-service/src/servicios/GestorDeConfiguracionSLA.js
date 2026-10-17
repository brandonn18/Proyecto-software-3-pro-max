// Servicio GestorDeConfiguracionSLA: listar y ajustar las horas por prioridad.
const { RepositorioDeConfiguracionSLA } = require('../interfaces');
const { ErrorNoEncontrado } = require('../errores');
const { Dependencias } = require('./Dependencias');

class GestorDeConfiguracionSLA {
  #repositorio;

  constructor(deps) {
    Dependencias.exigir(deps, { repositorio: RepositorioDeConfiguracionSLA });
    this.#repositorio = deps.repositorio;
  }

  listar() {
    return this.#repositorio.listar();
  }

  async ajustar(id, cambios) {
    const configuracion = await this.#repositorio.buscarPorId(id);
    if (!configuracion) throw new ErrorNoEncontrado('Configuración SLA no encontrada');
    configuracion.ajustar(cambios);
    return this.#repositorio.guardar(configuracion);
  }
}

module.exports = GestorDeConfiguracionSLA;
