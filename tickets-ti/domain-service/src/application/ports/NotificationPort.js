const { definirPuerto } = require('./definirPuerto');

/**
 * Entrega una notificación in-app a un usuario: la deja en su bandeja y, si
 * push es true, la empuja en tiempo real ('notificacion:nueva', que muestra un
 * toast). push es false cuando otro evento (ticket:nuevo, ticket:estado_cambiado)
 * ya avisa al usuario, para no duplicar el toast.
 *
 * notificar({ usuarioId, ticketId, tipo, mensaje, push }) → Promise<void>
 *     tipo: 'creacion' | 'asignacion' | 'resolucion' | 'sla_alerta'
 */
module.exports = definirPuerto('NotificationPort', ['notificar']);
