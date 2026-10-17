// Middleware de autenticación: exige un JWT de authcore válido y deja en
// req.actor la subclase de Actor que corresponde (Administrador, Tecnico...).
const VerificadorDeTokens = require('../authcore/VerificadorDeTokens');

const _rechazar = (res, message) => res.status(401).json({ success: false, message });

class Autenticacion {
  #verificador;

  constructor(verificador) {
    if (!(verificador instanceof VerificadorDeTokens)) throw new TypeError('Autenticacion requiere un VerificadorDeTokens');
    this.#verificador = verificador;
  }

  static #token(req) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    return header.split(' ')[1];
  }

  // Valida solo firma y expiración (sin BD ni red): por eso authcore emite tokens de 1h
  verificarToken = (req, res, next) => {
    const token = Autenticacion.#token(req);
    if (!token) return _rechazar(res, 'Token no proporcionado');
    const actor = this.#verificador.actorDesde(token);
    if (!actor) return _rechazar(res, 'Token inválido o expirado');
    req.actor = actor;
    return next();
  };

  static requiereRol(...roles) {
    return (req, res, next) => {
      if (!req.actor) return res.status(401).json({ success: false, message: 'No autenticado' });
      if (!roles.includes(req.actor.rol)) return res.status(403).json({ success: false, message: 'No tienes permiso para realizar esta acción' });
      return next();
    };
  }
}

module.exports = Autenticacion;
