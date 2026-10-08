const { validationResult } = require('express-validator');

// Corta el request con 400 si alguna regla de express-validator falló.
const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Datos inválidos', errors: errors.array() });
  }
  next();
};

module.exports = { validar };
