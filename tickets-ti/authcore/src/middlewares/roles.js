const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }
  if (!roles.includes(req.user.rol)) {
    return res.status(403).json({ success: false, message: 'No tienes permiso para realizar esta acción' });
  }
  next();
};

module.exports = { requireRole };
