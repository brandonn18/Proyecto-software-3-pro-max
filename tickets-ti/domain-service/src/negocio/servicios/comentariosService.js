// Capa de NEGOCIO: hilo de comentarios de un ticket.
const reglas = require('../reglas/reglasComentarios');
const { ticketOFallar } = require('./apoyo');

class ComentariosService {
  // dao: { tickets, comentarios }
  constructor({ dao }) {
    this.dao = dao;
  }

  async listar(ticketId, actor) {
    const ticket = await ticketOFallar(this.dao.tickets, ticketId);
    reglas.exigirLeer(ticket, actor);
    return this.dao.comentarios.listarPorTicket(ticket.id);
  }

  // El autor se guarda como snapshot (id, nombre, rol) del token
  async comentar(ticketId, texto, actor) {
    const ticket = await ticketOFallar(this.dao.tickets, ticketId);
    reglas.exigirComentar(ticket, actor);
    return this.dao.comentarios.insertar({
      ticketId: ticket.id, autorId: actor.id, autor_nombre: actor.nombre, autor_rol: actor.rol, texto: reglas.validarTexto(texto),
    });
  }
}

module.exports = { ComentariosService };
