const { ErrorNoImplementado } = require('../errores');

/**
 * Interfaz (clase abstracta) RepositorioDeAuditoria. Bitácora de acciones sobre tickets.
 * Las implementaciones la extienden y sobrescriben cada método.
 *
 * registrar(evento)         → Promise<void>                 evento: EventoDeAuditoria
 * listarPorTicket(ticketId) → Promise<EventoDeAuditoria[]>  orden: createdAt ASC
 */
class RepositorioDeAuditoria {
  constructor() {
    if (new.target === RepositorioDeAuditoria) throw new TypeError('RepositorioDeAuditoria es abstracta');
  }

  async registrar() { throw new ErrorNoImplementado(this, 'registrar'); }

  async listarPorTicket() { throw new ErrorNoImplementado(this, 'listarPorTicket'); }
}

module.exports = RepositorioDeAuditoria;
