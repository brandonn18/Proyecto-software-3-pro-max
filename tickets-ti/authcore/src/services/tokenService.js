const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn, ventanaRefreshSegundos } = require('../config/auth');
const blacklist = require('../utils/tokenBlacklist');
const { AppError } = require('../utils/AppError');

// Claims que consume domain-service: no agregar ni quitar sin actualizar su adaptador.
const generar = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );

const verificar = (token) => jwt.verify(token, jwtSecret);

const _claveBlacklist = (decoded, token) => decoded.jti || token;

const invalidar = (decoded, token) => blacklist.add(_claveBlacklist(decoded, token));

const estaInvalidado = (decoded, token) => blacklist.has(_claveBlacklist(decoded, token));

const renovar = (decoded, user) => {
  const restante = decoded.exp - Math.floor(Date.now() / 1000);
  if (restante > ventanaRefreshSegundos) {
    throw new AppError(400, 'El token aún tiene más de 1 hora de vigencia. No es necesario renovar.');
  }
  return generar(user);
};

module.exports = { generar, verificar, invalidar, estaInvalidado, renovar };
