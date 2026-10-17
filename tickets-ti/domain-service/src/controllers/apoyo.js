// Utilidades de los CONTROLADORES: manejo de errores async y limpieza de la entrada.
const sanitizeHtml = require('sanitize-html');

// Envuelve un handler async: cualquier error va al errorHandler central.
// Equivale al try { ... } catch (error) { next(error) } de cada controller.
const manejar = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

// Elimina todo HTML de los textos libres antes de pasárselos al modelo
const sanitizarTexto = (texto) => {
  if (typeof texto !== 'string') return texto;
  return sanitizeHtml(texto, { allowedTags: [], allowedAttributes: {} }).trim();
};

module.exports = { manejar, sanitizarTexto };
