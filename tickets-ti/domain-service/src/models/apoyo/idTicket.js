// Identificador de ticket: TKT-YYYY-NNNN, correlativo por año.
// Calcular el correlativo (contar tickets del año) es tarea del repositorio.
const { errorValidacion } = require('./errores');

const PATRON = /^TKT-(\d{4})-(\d{4,})$/;

const formatear = (anio, correlativo) => {
  if (!Number.isInteger(anio) || anio < 1000 || anio > 9999) throw errorValidacion(`Año inválido: ${anio}`);
  if (!Number.isInteger(correlativo) || correlativo < 1) throw errorValidacion(`Correlativo inválido: ${correlativo}`);
  return `TKT-${anio}-${String(correlativo).padStart(4, '0')}`;
};

const prefijoDelAnio = (anio) => `TKT-${anio}-`;

const esValido = (id) => typeof id === 'string' && PATRON.test(id);

module.exports = { formatear, prefijoDelAnio, esValido };
