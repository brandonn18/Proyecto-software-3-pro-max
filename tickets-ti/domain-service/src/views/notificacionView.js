// VISTA: JSON de una notificación de la bandeja (las columnas tal cual).
const { plano } = require('./plano');

const notificacion = (registro) => plano(registro);

module.exports = { notificacion };
