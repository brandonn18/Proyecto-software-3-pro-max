const { ErrorNoImplementado } = require('../errores');

/**
 * Interfaz (clase abstracta) Reloj. Reloj inyectable: los servicios nunca leen el reloj del sistema directamente.
 * Las implementaciones la extienden y sobrescriben cada método.
 *
 * ahora() → Date
 */
class Reloj {
  constructor() {
    if (new.target === Reloj) throw new TypeError('Reloj es abstracta');
  }

  ahora() { throw new ErrorNoImplementado(this, 'ahora'); }
}

module.exports = Reloj;
