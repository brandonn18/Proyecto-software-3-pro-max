// Error de aplicación con código HTTP; el errorHandler central lo traduce.
class AppError extends Error {
  constructor(status, message, errors = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.errors = errors;
  }
}

module.exports = { AppError };
