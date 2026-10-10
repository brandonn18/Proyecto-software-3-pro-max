// Firma tokens con la misma forma que JwtTokenProviderAdapter de authcore (Java):
// { sub: username, uid, roles: ['ADMIN'|'TECNICO'|'USER'] }.
const jwt = require('jsonwebtoken');

const ROLE_AUTHCORE = Object.freeze({ administrador: 'ADMIN', tecnico: 'TECNICO', usuario: 'USER' });

const firmarComoAuthcore = ({ id, nombre, rol }, { secreto = process.env.JWT_SECRET, ...opciones } = {}) =>
  jwt.sign({ sub: nombre, uid: id, roles: [ROLE_AUTHCORE[rol] || rol] }, secreto, { expiresIn: '1h', ...opciones });

module.exports = { firmarComoAuthcore, ROLE_AUTHCORE };
