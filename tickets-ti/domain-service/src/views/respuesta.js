// VISTA: sobre común de todas las respuestas JSON (CLAUDE.md, "Estructura de
// respuesta API"). Funciones puras: reciben datos y devuelven el objeto.

const exito = (data, message = 'OK') => ({ success: true, data, message });

// pagina: { total, page, limit } que devuelven los modelos al listar
const paginado = (data, { total, page, limit }) => ({
  success: true, data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
});

const error = (message, errors = []) => ({ success: false, message, errors });

module.exports = { exito, paginado, error };
