const { validationResult } = require('express-validator');
const PresentadorJSON = require('./PresentadorJSON');

class Validacion {
  // Middleware: corta el request con 400 si alguna regla de express-validator falló
  static resultado(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json(PresentadorJSON.error('Datos inválidos', errors.array()));
    return next();
  }
}

module.exports = Validacion;
