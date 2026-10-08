const { definirPuerto } = require('./definirPuerto');

/**
 * Reloj inyectable: los casos de uso nunca llaman a new Date() directamente.
 *
 * ahora() → Date
 */
module.exports = definirPuerto('Clock', ['ahora']);
