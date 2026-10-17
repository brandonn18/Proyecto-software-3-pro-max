const { ErrorNoImplementado } = require('../errores');

/**
 * Interfaz (clase abstracta) CanalEnTiempoReal. Eventos en tiempo real hacia el frontend.
 * Las implementaciones la extienden y sobrescriben cada método.
 *
 * emitirAUsuario(usuarioId, evento, datos) → void
 * emitirATecnico(tecnicoId, evento, datos) → void
 * emitirAAdmins(evento, datos)             → void
 */
class CanalEnTiempoReal {
  constructor() {
    if (new.target === CanalEnTiempoReal) throw new TypeError('CanalEnTiempoReal es abstracta');
  }

  emitirAUsuario() { throw new ErrorNoImplementado(this, 'emitirAUsuario'); }

  emitirATecnico() { throw new ErrorNoImplementado(this, 'emitirATecnico'); }

  emitirAAdmins() { throw new ErrorNoImplementado(this, 'emitirAAdmins'); }
}

module.exports = CanalEnTiempoReal;
