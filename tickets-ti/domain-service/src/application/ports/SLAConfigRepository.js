const { definirPuerto } = require('./definirPuerto');

/**
 * Configuración de SLA por prioridad: { id, prioridad, tiempo_horas, porcentaje_alerta }.
 *
 * obtenerPorPrioridad(prioridad) → Promise<config|null>
 * listar()                       → Promise<config[]>  orden: tiempo_horas ASC
 * actualizar(id, cambios)        → Promise<config|null> null si no existe
 */
module.exports = definirPuerto('SLAConfigRepository', ['obtenerPorPrioridad', 'listar', 'actualizar']);
