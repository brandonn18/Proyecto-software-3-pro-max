// Capa de NEGOCIO: identifica al actor de cada petición a partir del JWT de
// authcore. La lectura del token la hace la capa de datos (tokens.js).
const { actorDesdeToken } = require('../../datos/integraciones/tokens');

class SesionService {
  constructor({ jwtSecret }) {
    if (!jwtSecret) throw new Error('SesionService requiere jwtSecret');
    this.jwtSecret = jwtSecret;
  }

  // → actor { id, rol, nombre, email } | null
  actorDesdeToken(token) {
    return actorDesdeToken(token, this.jwtSecret);
  }
}

module.exports = { SesionService };
