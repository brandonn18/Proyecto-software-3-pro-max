// Lectura del JWT emitido por authcore: solo firma y expiración (sin BD ni
// red). La usan el servicio de sesión (negocio) y el servidor de Socket.io.
const jwt = require('jsonwebtoken');
const { actorDesdeClaims } = require('./contratoAuthcore');

// → { id, rol, nombre, email } | null si el token es inválido, expiró o rompe el contrato
const actorDesdeToken = (token, secreto) => {
  try {
    return actorDesdeClaims(jwt.verify(token, secreto));
  } catch {
    return null;
  }
};

module.exports = { actorDesdeToken };
