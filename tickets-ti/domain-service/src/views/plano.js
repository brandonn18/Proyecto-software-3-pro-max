// VISTA: las vistas reciben instancias de modelos o filas sueltas; esto las
// convierte en objetos planos sin consultar nada (no importa los modelos).
const plano = (registro) => (typeof registro?.get === 'function' ? registro.get({ plain: true }) : { ...registro });

module.exports = { plano };
