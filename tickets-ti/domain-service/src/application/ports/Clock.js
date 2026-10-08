const { definirPuerto } = require('./definirPuerto');

/**
 * Reloj inyectable: los casos de uso nunca leen el reloj del sistema directamente.
 *
 * ahora() → Date
 */
module.exports = definirPuerto('Clock', ['ahora']);
