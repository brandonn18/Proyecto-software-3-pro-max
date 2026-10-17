// VISTA: JSON de una configuración de SLA (las columnas tal cual).
const { plano } = require('./plano');

const config = (registro) => plano(registro);

module.exports = { config };
