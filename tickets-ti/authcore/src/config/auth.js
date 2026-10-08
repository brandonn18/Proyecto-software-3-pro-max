const { requerirEnv } = require('./env');

module.exports = {
  jwtSecret: requerirEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  internalKey: requerirEnv('AUTHCORE_INTERNAL_KEY'),
  bcryptRounds: 12,
  maxLoginAttempts: 5,
  lockDurationMinutes: 15,
  // Solo se renueva un token al que le quede menos de esto (segundos)
  ventanaRefreshSegundos: 3600,
};
