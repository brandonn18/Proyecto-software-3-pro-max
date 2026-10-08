const { definirPuerto } = require('./definirPuerto');

/**
 * Emails transaccionales de tickets. `persona` es { id, nombre, email } del directorio.
 *
 * enviarTicketAsignado(tecnico, ticket)            → Promise<void>
 * enviarTicketResuelto(usuario, ticket)            → Promise<void>
 * enviarAlertaSLA(tecnico, ticket, porcentaje)     → Promise<void>
 */
module.exports = definirPuerto('EmailPort', ['enviarTicketAsignado', 'enviarTicketResuelto', 'enviarAlertaSLA']);
