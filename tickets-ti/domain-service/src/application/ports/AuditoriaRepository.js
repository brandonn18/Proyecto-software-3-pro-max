const { definirPuerto } = require('./definirPuerto');

/**
 * Bitácora de acciones sobre tickets. El nombre del actor se guarda como
 * snapshot para no consultar authcore al mostrar el historial.
 *
 * registrar({ ticketId, actor: { id, nombre }, accion, detalle }) → Promise<void>
 * listarPorTicket(ticketId) → Promise<[{ id, accion, detalle, createdAt, usuario: { id, nombre } | null }]>
 *     orden: createdAt ASC
 */
module.exports = definirPuerto('AuditoriaRepository', ['registrar', 'listarPorTicket']);
