const { User } = require('../models');
const tokenService = require('../services/tokenService');

const _rechazar = (res, message) => res.status(401).json({ success: false, message });

const _extraerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
};

// En authcore se consulta la BD en cada request: aquí sí aplica la
// desactivación inmediata y la blacklist de logout.
const verifyToken = async (req, res, next) => {
  const token = _extraerToken(req);
  if (!token) return _rechazar(res, 'Token no proporcionado');
  try {
    const decoded = tokenService.verificar(token);
    if (tokenService.estaInvalidado(decoded, token)) return _rechazar(res, 'Token invalidado');

    const user = await User.findByPk(decoded.id);
    if (!user || !user.activo) return _rechazar(res, 'Usuario no válido o inactivo');

    req.user = user;
    req.token = token;
    req.tokenDecoded = decoded;
    next();
  } catch (error) {
    return _rechazar(res, 'Token inválido o expirado');
  }
};

module.exports = { verifyToken };
