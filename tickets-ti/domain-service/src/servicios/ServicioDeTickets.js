// Clase base de los servicios que trabajan sobre un ticket existente (herencia):
// guarda el repositorio y ofrece buscarlo o fallar con NO_ENCONTRADO.
const { RepositorioDeTickets } = require('../interfaces');
const { ErrorNoEncontrado } = require('../errores');

class ServicioDeTickets {
  #tickets;

  constructor(tickets) {
    if (new.target === ServicioDeTickets) throw new TypeError('ServicioDeTickets es abstracta');
    if (!(tickets instanceof RepositorioDeTickets)) throw new TypeError('tickets debe ser una instancia de RepositorioDeTickets');
    this.#tickets = tickets;
  }

  // Para las subclases (protegido por convención)
  get _tickets() { return this.#tickets; }

  async _ticketOFallar(id) {
    const ticket = await this.#tickets.buscarPorId(id);
    if (!ticket) throw new ErrorNoEncontrado('Ticket no encontrado');
    return ticket;
  }
}

module.exports = ServicioDeTickets;
