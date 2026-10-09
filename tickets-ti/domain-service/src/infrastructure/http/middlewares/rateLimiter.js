const rateLimit = require('express-rate-limit');

const pasaThrough = (_req, _res, next) => next();

const crearRateLimiter = ({ deshabilitado = false } = {}) => (deshabilitado ? pasaThrough : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes, intenta de nuevo en 15 minutos' },
}));

module.exports = { crearRateLimiter };
