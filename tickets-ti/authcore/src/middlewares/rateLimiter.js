const rateLimit = require('express-rate-limit');

const esTest = process.env.NODE_ENV === 'test';
const pasaThrough = (_req, _res, next) => next();

const rateLimiter = esTest ? pasaThrough : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes, intenta de nuevo en 15 minutos' },
});

// 10 intentos por minuto en endpoints de autenticación
const authLimiter = esTest ? pasaThrough : rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos, espera 1 minuto' },
});

module.exports = { rateLimiter, authLimiter };
