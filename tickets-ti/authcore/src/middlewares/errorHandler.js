const ERRORES_VALIDACION_BD = ['SequelizeValidationError', 'SequelizeUniqueConstraintError'];

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.name === 'AppError') {
    return res.status(err.status).json({ success: false, message: err.message, errors: err.errors });
  }
  if (ERRORES_VALIDACION_BD.includes(err.name)) {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: err.errors.map((e) => ({ field: e.path, message: e.message })),
    });
  }
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: 'Error interno del servidor', errors: [] });
};

module.exports = { errorHandler };
