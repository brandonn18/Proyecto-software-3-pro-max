// Capa de PRESENTACIÓN: exige un JWT de authcore válido. Quién es el actor lo
// decide la capa de negocio (sesionService); aquí solo se lee el header.

const _rechazar = (res, message) => res.status(401).json({ success: false, message });

const _extraerToken = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.split(' ')[1];
};

// sesion: sesionService { actorDesdeToken }. Valida solo firma y expiración
// (sin BD ni red): por eso authcore emite tokens de 1h.
const crearVerificarToken = (sesion) => {
  if (typeof sesion?.actorDesdeToken !== 'function') throw new Error('crearVerificarToken requiere el servicio de sesión');
  return (req, res, next) => {
    const token = _extraerToken(req);
    if (!token) return _rechazar(res, 'Token no proporcionado');
    const actor = sesion.actorDesdeToken(token);
    if (!actor) return _rechazar(res, 'Token inválido o expirado');
    req.actor = actor;
    return next();
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
