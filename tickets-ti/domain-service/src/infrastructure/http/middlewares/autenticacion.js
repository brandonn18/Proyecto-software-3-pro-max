const jwt = require('jsonwebtoken');
const { actorDesdeClaims } = require('../../authcore/contratoAuthcore');

const _rechazar = (res, message) => res.status(401).json({ success: false, message });

const _extraerToken = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.split(' ')[1];
};

// Valida el JWT emitido por authcore SOLO por firma y expiración (sin BD ni
// red). Un usuario desactivado conserva acceso hasta que expire su token:
// por eso authcore emite tokens de 1h.
const crearVerificarToken = (jwtSecret) => {
  if (!jwtSecret) throw new Error('crearVerificarToken requiere jwtSecret');
  return (req, res, next) => {
    const token = _extraerToken(req);
    if (!token) return _rechazar(res, 'Token no proporcionado');
    try {
      const actor = actorDesdeClaims(jwt.verify(token, jwtSecret));
      if (!actor) return _rechazar(res, 'Token inválido o expirado');
      req.actor = actor;
      return next();
    } catch {
      return _rechazar(res, 'Token inválido o expirado');
    }
  };
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.actor) return res.status(401).json({ success: false, message: 'No autenticado' });
  if (!roles.includes(req.actor.rol)) {
    return res.status(403).json({ success: false, message: 'No tienes permiso para realizar esta acción' });
  }
  return next();
};

module.exports = { crearVerificarToken, requireRole };
