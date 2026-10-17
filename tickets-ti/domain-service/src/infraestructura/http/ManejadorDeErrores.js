// Traducción de errores a HTTP según la CLASE del error (jerarquía de
// errores/index.js). Es el único lugar que conoce esa correspondencia.
const {
  ErrorDeValidacion, ErrorDeTransicion, ErrorDeAcceso, ErrorNoEncontrado, ErrorDirectorioNoDisponible,
} = require('../../errores');
const PresentadorJSON = require('./PresentadorJSON');

const STATUS_POR_CLASE = Object.freeze([
  [ErrorDeValidacion, 400],
  [ErrorDeTransicion, 400],
  [ErrorDeAcceso, 403],
  [ErrorNoEncontrado, 404],
]);

class ManejadorDeErrores {
  #logger;

  constructor(logger = console) {
    this.#logger = logger;
  }

  static statusPara(error) {
    return STATUS_POR_CLASE.find(([Clase]) => error instanceof Clase)?.[1] ?? null;
  }

  // eslint-disable-next-line no-unused-vars
  middleware = (err, req, res, next) => {
    const status = ManejadorDeErrores.statusPara(err);
    if (status) return res.status(status).json(PresentadorJSON.error(err.message));
    if (err instanceof ErrorDirectorioNoDisponible) {
      this.#logger.error('[HTTP] authcore no disponible:', err.causa?.message);
      return res.status(503).json(PresentadorJSON.error('El servicio de usuarios no está disponible. Intenta de nuevo en unos minutos.'));
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json(PresentadorJSON.error('JSON inválido'));
    this.#logger.error('[HTTP] error no controlado:', err.stack || err.message);
    return res.status(500).json(PresentadorJSON.error('Error interno del servidor'));
  };
}

module.exports = ManejadorDeErrores;
