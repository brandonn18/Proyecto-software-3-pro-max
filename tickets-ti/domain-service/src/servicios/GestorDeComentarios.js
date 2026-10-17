// Servicio GestorDeComentarios: el Actor decide si puede leer o comentar y el
// estado del ticket si admite comentarios (Cerrado no).
const { RepositorioDeComentarios } = require('../interfaces');
const { ErrorDeAcceso, ErrorDeTransicion } = require('../errores');
const Comentario = require('../entidades/Comentario');
const ServicioDeTickets = require('./ServicioDeTickets');
const { Dependencias } = require('./Dependencias');

class GestorDeComentarios extends ServicioDeTickets {
  #comentarios;

  // deps: { tickets, comentarios }
  constructor(deps) {
    super(deps?.tickets);
    Dependencias.exigir(deps, { comentarios: RepositorioDeComentarios });
    this.#comentarios = deps.comentarios;
  }

  async listar(ticketId, actor) {
    const ticket = await this._ticketOFallar(ticketId);
    if (!actor.puedeVer(ticket)) throw new ErrorDeAcceso('Sin acceso a este ticket');
    return this.#comentarios.listarPorTicket(ticket.id);
  }

  async comentar(ticketId, texto, actor) {
    const ticket = await this._ticketOFallar(ticketId);
    if (!actor.puedeComentar(ticket)) throw new ErrorDeAcceso('Solo el solicitante, el técnico asignado o un administrador pueden comentar');
    if (!ticket.admiteComentarios()) throw new ErrorDeTransicion('No se puede comentar un ticket cerrado; reábrelo primero');
    return this.#comentarios.guardar(new Comentario({ ticketId: ticket.id, autor: actor.aSnapshot(), texto }));
  }
}

module.exports = GestorDeComentarios;
