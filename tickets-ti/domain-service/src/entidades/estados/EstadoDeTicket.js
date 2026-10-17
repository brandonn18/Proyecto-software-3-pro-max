// Patrón State: cada estado del ciclo de vida es una subclase que sabe a qué
// estados puede pasar y qué permite. El Ticket delega en su estado actual en
// vez de preguntar con if/switch (polimorfismo).
const { ESTADOS } = require('../../valores/catalogos');
const { ErrorDeValidacion, ErrorDeTransicion, ErrorNoImplementado } = require('../../errores');

const registro = new Map();

class EstadoDeTicket {
  constructor() {
    if (new.target === EstadoDeTicket) throw new TypeError('EstadoDeTicket es abstracta');
  }

  // Cada subclase se registra para que EstadoDeTicket.desde(nombre) la encuentre
  static registrar(Clase) {
    registro.set(new Clase().nombre, Clase);
  }

  static desde(nombre) {
    if (!ESTADOS.includes(nombre)) throw new ErrorDeValidacion(`Estado inválido: ${nombre}`);
    return new (registro.get(nombre))();
  }

  get nombre() { throw new ErrorNoImplementado(this, 'nombre'); }

  // Nombres de los estados a los que se puede pasar desde este
  get siguientes() { throw new ErrorNoImplementado(this, 'siguientes'); }

  esFinal() { return false; }

  permiteAsignar() { return !this.esFinal(); }

  permiteReabrir() { return this.esFinal(); }

  permiteComentar() { return true; }

  transicionarA(nombre) {
    const destino = EstadoDeTicket.desde(nombre);
    if (!this.siguientes.includes(nombre)) {
      throw new ErrorDeTransicion(
        `Transición inválida: '${this.nombre}' → '${nombre}'. Permitidos: ${this.siguientes.join(', ') || 'ninguno'}`
      );
    }
    return destino;
  }

  toString() { return this.nombre; }
}

module.exports = EstadoDeTicket;
