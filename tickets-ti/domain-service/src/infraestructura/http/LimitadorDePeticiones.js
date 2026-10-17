const rateLimit = require('express-rate-limit');

// Límite de peticiones por IP: 100 cada 15 minutos (apagado en tests).
class LimitadorDePeticiones {
  static crear({ deshabilitado = false } = {}) {
    if (deshabilitado) return (_req, _res, next) => next();
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Demasiadas solicitudes, intenta de nuevo en 15 minutos' },
    });
  }
}

module.exports = LimitadorDePeticiones;
