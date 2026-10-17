const { ErrorNoImplementado } = require('../errores');

/**
 * Interfaz (clase abstracta) RepositorioDeComentarios. Hilo de comentarios de cada ticket.
 * Las implementaciones la extienden y sobrescriben cada método.
 *
 * guardar(comentario)       → Promise<Comentario>  copia con id y fecha
 * listarPorTicket(ticketId) → Promise<Comentario[]> del más antiguo al más nuevo
 */
class RepositorioDeComentarios {
  constructor() {
    if (new.target === RepositorioDeComentarios) throw new TypeError('RepositorioDeComentarios es abstracta');
  }

  async guardar() { throw new ErrorNoImplementado(this, 'guardar'); }

  async listarPorTicket() { throw new ErrorNoImplementado(this, 'listarPorTicket'); }
}

module.exports = RepositorioDeComentarios;
