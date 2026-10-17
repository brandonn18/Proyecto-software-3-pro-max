const { ErrorNoImplementado } = require('../errores');

/**
 * Interfaz (clase abstracta) EstrategiaDeAsignacion. Patrón Strategy: cómo elegir técnico para un ticket nuevo.
 * Las implementaciones la extienden y sobrescriben cada método.
 *
 * elegir(candidatos) → PersonaDelDirectorio|null  candidatos: [{ tecnico, cargaCategoria, cargaGlobal }]
 */
class EstrategiaDeAsignacion {
  constructor() {
    if (new.target === EstrategiaDeAsignacion) throw new TypeError('EstrategiaDeAsignacion es abstracta');
  }

  elegir() { throw new ErrorNoImplementado(this, 'elegir'); }
}

module.exports = EstrategiaDeAsignacion;
