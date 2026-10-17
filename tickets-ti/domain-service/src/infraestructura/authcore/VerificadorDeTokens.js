// Lee el JWT emitido por authcore: solo firma y expiración (sin BD ni red).
// Lo usan el middleware de autenticación HTTP y el canal de Socket.io.
const jwt = require('jsonwebtoken');
const ContratoAuthcore = require('./ContratoAuthcore');

class VerificadorDeTokens {
  #secreto;

  constructor(secreto) {
    if (!secreto) throw new Error('VerificadorDeTokens requiere el secreto JWT');
    this.#secreto = secreto;
  }

  // → Actor | null si el token es inválido, expiró o rompe el contrato
  actorDesde(token) {
    try {
      return ContratoAuthcore.actorDesdeClaims(jwt.verify(token, this.#secreto));
    } catch {
      return null;
    }
  }
}

module.exports = VerificadorDeTokens;
