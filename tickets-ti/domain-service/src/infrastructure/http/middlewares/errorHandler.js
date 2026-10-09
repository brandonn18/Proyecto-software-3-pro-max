const { CODIGOS } = require('../../../domain/errores');

// Traducción de errores de dominio/aplicación a HTTP. Es el único lugar que
// conoce esa correspondencia: el dominio no sabe nada de status codes.
const STATUS_POR_CODIGO = Object.freeze({
  [CODIGOS.VALIDACION]: 400,
  [CODIGOS.TRANSICION_INVALIDA]: 400,
  [CODIGOS.ACCESO_DENEGADO]: 403,
  [CODIGOS.NO_ENCONTRADO]: 404,
});

const _responder = (res, status, message, errors = []) => res.status(status).json({ success: false, message, errors });

const crearErrorHandler = (logger = console) =>
  // eslint-disable-next-line no-unused-vars
  (err, req, res, next) => {
    if (err.name === 'ErrorDominio' && STATUS_POR_CODIGO[err.codigo]) {
      return _responder(res, STATUS_POR_CODIGO[err.codigo], err.message);
    }
    if (err.name === 'ErrorDirectorioNoDisponible') {
      logger.error('[HTTP] authcore no disponible:', err.causa?.message);
      return _responder(res, 503, 'El servicio de usuarios no está disponible. Intenta de nuevo en unos minutos.');
    }
    if (err.type === 'entity.parse.failed') return _responder(res, 400, 'JSON inválido');
    logger.error('[HTTP] error no controlado:', err.stack || err.message);
    return _responder(res, 500, 'Error interno del servidor');
  };

module.exports = { crearErrorHandler, STATUS_POR_CODIGO };
