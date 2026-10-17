const { ErrorNoImplementado } = require('../errores');

/**
 * Interfaz (clase abstracta) ServicioDeCorreo. Emails transaccionales de tickets.
 * Las implementaciones la extienden y sobrescriben cada método.
 *
 * enviarTicketAsignado(tecnico, ticket)        → Promise<void>  tecnico: PersonaDelDirectorio, ticket: Ticket
 * enviarTicketResuelto(usuario, ticket)        → Promise<void>
 * enviarAlertaSLA(tecnico, ticket, porcentaje) → Promise<void>
 */
class ServicioDeCorreo {
  constructor() {
    if (new.target === ServicioDeCorreo) throw new TypeError('ServicioDeCorreo es abstracta');
  }

  async enviarTicketAsignado() { throw new ErrorNoImplementado(this, 'enviarTicketAsignado'); }

  async enviarTicketResuelto() { throw new ErrorNoImplementado(this, 'enviarTicketResuelto'); }

  async enviarAlertaSLA() { throw new ErrorNoImplementado(this, 'enviarAlertaSLA'); }
}

module.exports = ServicioDeCorreo;
