// Entidad Notificacion: un aviso de la bandeja in-app de un usuario.
class Notificacion {
  #id;
  #usuarioId;
  #ticketId;
  #tipo;
  #mensaje;
  #leida;
  #creadaEn;

  // tipo: 'creacion' | 'asignacion' | 'resolucion' | 'sla_alerta'
  constructor({ id, usuarioId, ticketId = null, tipo, mensaje, leida = false, createdAt = null }) {
    this.#id = id;
    this.#usuarioId = usuarioId;
    this.#ticketId = ticketId;
    this.#tipo = tipo;
    this.#mensaje = mensaje;
    this.#leida = leida;
    this.#creadaEn = createdAt;
  }

  get id() { return this.#id; }

  get usuarioId() { return this.#usuarioId; }

  get leida() { return this.#leida; }

  perteneceA(usuarioId) { return this.#usuarioId === usuarioId; }

  aJSON() {
    return {
      id: this.#id, usuarioId: this.#usuarioId, ticketId: this.#ticketId, tipo: this.#tipo,
      mensaje: this.#mensaje, leida: this.#leida, createdAt: this.#creadaEn,
    };
  }
}

module.exports = Notificacion;
