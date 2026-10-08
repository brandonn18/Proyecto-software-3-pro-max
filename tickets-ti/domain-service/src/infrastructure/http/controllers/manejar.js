// Envuelve un handler async: cualquier error va al errorHandler central.
// Equivale al try { ... } catch (error) { next(error) } de cada controller.
const manejar = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

const ok = (res, data, message = 'OK', status = 200) => res.status(status).json({ success: true, data, message });

const paginado = (res, { items, meta }) => res.json({ success: true, data: items, meta });

module.exports = { manejar, ok, paginado };
