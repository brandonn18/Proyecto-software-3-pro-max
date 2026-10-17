// Entidad EventoDeAuditoria: una línea de la bitácora de un ticket. El actor
// se guarda como snapshot para no consultar authcore al mostrar el historial.
class EventoDeAuditoria {
  #id;
  #ticketId;
  #accion;
  #detalle;
  #actor;
  #creadoEn;

  constructor({ id = null, ticketId, accion, detalle = null, actor = null, creadoEn = null }) {
    this.#id = id;
    this.#ticketId = ticketId;
    this.#accion = accion;
    this.#detalle = detalle;
    this.#actor = actor ? Object.freeze({ id: actor.id, nombre: actor.nombre }) : null;
    this.#creadoEn = creadoEn;
  }

  get ticketId() { return this.#ticketId; }

  get accion() { return this.#accion; }

  get detalle() { return this.#detalle; }

  get actor() { return this.#actor; }

  aJSON() {
    return { id: this.#id, accion: this.#accion, detalle: this.#detalle, createdAt: this.#creadoEn, usuario: this.#actor ? { ...this.#actor } : null };
  }
}

module.exports = EventoDeAuditoria;
