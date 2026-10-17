const { validationResult } = require('express-validator');
const respuesta = require('../views/respuesta');

// Corta el request con 400 si alguna regla de express-validator falló.
const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json(respuesta.error('Datos inválidos', errors.array()));
  return next();
};

module.exports = { validar };
