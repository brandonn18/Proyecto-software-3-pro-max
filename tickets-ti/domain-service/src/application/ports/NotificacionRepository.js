const { definirPuerto } = require('./definirPuerto');

/**
 * Consulta y marcado de la bandeja de notificaciones de un usuario.
 *
 * listarDe(usuarioId, { tipo?, page, limit }) → Promise<{ items, total }>  orden: no leídas primero, luego createdAt DESC
 * contarNoLeidas(usuarioId)                  → Promise<number>
 * marcarLeida(id, usuarioId)                 → Promise<notificacion|null> null si no existe o es de otro usuario
 * marcarTodasLeidas(usuarioId)               → Promise<void>
 */
module.exports = definirPuerto('NotificacionRepository', [
  'listarDe', 'contarNoLeidas', 'marcarLeida', 'marcarTodasLeidas',
]);
