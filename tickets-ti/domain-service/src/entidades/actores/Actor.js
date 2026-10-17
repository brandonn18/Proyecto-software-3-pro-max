// Clase abstracta Actor: quien hace la petición (claims del JWT de authcore).
// Cada rol es una subclase que responde a su manera "¿puedo ver/modificar/
// reabrir/comentar este ticket?" (polimorfismo en lugar de if por rol).
const { ErrorDeValidacion, ErrorNoImplementado } = require('../../errores');

class Actor {
  #id;
  #nombre;

  constructor({ id, nombre }) {
    if (new.target === Actor) throw new TypeError('Actor es abstracta');
    if (!Number.isInteger(id)) throw new ErrorDeValidacion('Usuario inválido');
    if (typeof nombre !== 'string' || !nombre.trim()) throw new ErrorDeValidacion('Nombre del usuario requerido');
    this.#id = id;
    this.#nombre = nombre;
  }

  get id() { return this.#id; }

  get nombre() { return this.#nombre; }

  get rol() { throw new ErrorNoImplementado(this, 'rol'); }

  puedeVer() { throw new ErrorNoImplementado(this, 'puedeVer'); }

  puedeCambiarEstado() { throw new ErrorNoImplementado(this, 'puedeCambiarEstado'); }

  puedeReabrir() { throw new ErrorNoImplementado(this, 'puedeReabrir'); }

  // Comentan el administrador, el técnico asignado y el dueño
  puedeComentar() { throw new ErrorNoImplementado(this, 'puedeComentar'); }

  // Filtro que se impone al listar: { usuarioId } | { tecnicoId } | {}
  filtroDeListado() { throw new ErrorNoImplementado(this, 'filtroDeListado'); }

  esDuenioDe(ticket) { return ticket.solicitante.id === this.#id; }

  esTecnicoDe(ticket) { return ticket.tecnico?.id === this.#id; }

  aSnapshot() { return { id: this.#id, nombre: this.#nombre, rol: this.rol }; }
}

module.exports = Actor;
