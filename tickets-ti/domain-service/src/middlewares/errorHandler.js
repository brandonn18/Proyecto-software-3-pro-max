const { CODIGOS } = require('../models/apoyo/errores');
const respuesta = require('../views/respuesta');

// Traducción de errores de los modelos a HTTP. Es el único lugar que conoce
// esa correspondencia: los modelos no saben nada de status codes.
const STATUS_POR_CODIGO = Object.freeze({
  [CODIGOS.VALIDACION]: 400,
  [CODIGOS.TRANSICION_INVALIDA]: 400,
  [CODIGOS.ACCESO_DENEGADO]: 403,
  [CODIGOS.NO_ENCONTRADO]: 404,
});

const crearErrorHandler = (logger = console) =>
  // eslint-disable-next-line no-unused-vars
  (err, req, res, next) => {
    if (err.name === 'ErrorDominio' && STATUS_POR_CODIGO[err.codigo]) {
      return res.status(STATUS_POR_CODIGO[err.codigo]).json(respuesta.error(err.message));
    }
    if (err.name === 'ErrorDirectorioNoDisponible') {
      logger.error('[HTTP] authcore no disponible:', err.causa?.message);
      return res.status(503).json(respuesta.error('El servicio de usuarios no está disponible. Intenta de nuevo en unos minutos.'));
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json(respuesta.error('JSON inválido'));
    logger.error('[HTTP] error no controlado:', err.stack || err.message);
    return res.status(500).json(respuesta.error('Error interno del servidor'));
  };

module.exports = { crearErrorHandler, STATUS_POR_CODIGO };
