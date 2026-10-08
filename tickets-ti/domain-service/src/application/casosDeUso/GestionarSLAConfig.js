const { SLAConfigRepository } = require('../ports');
const { requerirDependencias, noEncontrado } = require('../dependencias');
const { errorValidacion } = require('../../domain/errores');

const _enteroEnRango = (valor, campo, min, max) => {
  if (!Number.isInteger(valor) || valor < min || valor > max) {
    throw errorValidacion(`${campo} debe ser un entero entre ${min} y ${max}`);
  }
  return valor;
};

// Solo tiempo_horas y porcentaje_alerta son editables; la prioridad de una
// configuración no cambia (en el monolito se podía vía req.body).
const _cambiosPermitidos = ({ tiempo_horas, porcentaje_alerta }) => {
  const cambios = {};
  if (tiempo_horas !== undefined) cambios.tiempo_horas = _enteroEnRango(tiempo_horas, 'tiempo_horas', 1, 8760);
  if (porcentaje_alerta !== undefined) {
    cambios.porcentaje_alerta = _enteroEnRango(porcentaje_alerta, 'porcentaje_alerta', 1, 100);
  }
  return cambios;
};

class GestionarSLAConfig {
  constructor(deps) {
    requerirDependencias(deps, { slaConfigRepository: SLAConfigRepository });
    this.repo = deps.slaConfigRepository;
  }

  listar() {
    return this.repo.listar();
  }

  async actualizar(id, datos) {
    const config = await this.repo.actualizar(id, _cambiosPermitidos(datos));
    if (!config) throw noEncontrado('Configuración SLA no encontrada');
    return config;
  }
}

module.exports = GestionarSLAConfig;
