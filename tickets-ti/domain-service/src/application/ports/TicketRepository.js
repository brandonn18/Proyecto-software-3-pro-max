const { definirPuerto } = require('./definirPuerto');

/**
 * Persistencia de tickets. Trabaja con entidades Ticket del dominio.
 *
 * buscarPorId(id)                     → Promise<Ticket|null>
 * contarDelAnio(anio)                 → Promise<number>  tickets con prefijo TKT-anio- (incluye eliminados)
 * guardarNuevo(ticket)                → Promise<Ticket>  lanza ErrorIdDuplicado si el id ya existe
 * actualizar(ticket)                  → Promise<Ticket>
 * eliminar(id)                        → Promise<void>    borrado lógico
 * listar({ filtros, page, limit })    → Promise<{ items: Ticket[], total: number }>
 *     filtros: estado, prioridad, tipo, categoria, tecnicoId, usuarioId, search, fechaDesde, fechaHasta
 *     orden: createdAt DESC
 * contarCargaActiva({ tecnicoId, categoria? }) → Promise<number>  tickets no resueltos ni cerrados
 * listarPendientesDeAlertaSLA()       → Promise<Ticket[]> activos, con técnico, con sla_limite y sin alerta enviada
 */
module.exports = definirPuerto('TicketRepository', [
  'buscarPorId', 'contarDelAnio', 'guardarNuevo', 'actualizar', 'eliminar',
  'listar', 'contarCargaActiva', 'listarPendientesDeAlertaSLA',
]);
