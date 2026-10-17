// Clase base de los controladores (patrón Template Method): accion() pone el
// esqueleto común (try/catch → errorHandler central) y cada subclase solo
// escribe el paso propio. Los controladores solo traducen HTTP → servicio.
const sanitizeHtml = require('sanitize-html');
const PresentadorJSON = require('./PresentadorJSON');

class ControladorBase {
  constructor() {
    if (new.target === ControladorBase) throw new TypeError('ControladorBase es abstracta');
  }

  // paso: async (req, res) => void
  accion(paso) {
    return async (req, res, next) => {
      try {
        await paso(req, res);
      } catch (error) {
        next(error);
      }
    };
  }

  responder(res, data, message = 'OK', status = 200) {
    res.status(status).json(PresentadorJSON.exito(data, message));
  }

  paginar(res, items, meta) {
    res.json(PresentadorJSON.paginado(items, meta));
  }

  // Elimina todo HTML de los textos libres antes de llegar al servicio
  sanitizar(texto) {
    if (typeof texto !== 'string') return texto;
    return sanitizeHtml(texto, { allowedTags: [], allowedAttributes: {} }).trim();
  }
}

module.exports = ControladorBase;
