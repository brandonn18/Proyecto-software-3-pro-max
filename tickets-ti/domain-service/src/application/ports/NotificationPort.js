const { definirPuerto } = require('./definirPuerto');

/**
 * Entrega una notificación in-app a un usuario: la deja en su bandeja y la
 * empuja en tiempo real ('notificacion:nueva').
 *
 * notificar({ usuarioId, ticketId, tipo, mensaje }) → Promise<void>
 *     tipo: 'creacion' | 'asignacion' | 'resolucion' | 'sla_alerta'
 */
module.exports = definirPuerto('NotificationPort', ['notificar']);
