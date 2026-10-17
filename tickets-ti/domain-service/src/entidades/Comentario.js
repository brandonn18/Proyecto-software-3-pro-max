// Entidad Comentario: un mensaje del hilo de un ticket. El autor se guarda
// como snapshot (id, nombre, rol). Un comentario recién escrito no tiene id ni
// fecha hasta que se persiste.
const { ErrorDeValidacion } = require('../errores');

const LONGITUD_MAXIMA = 2000;

class Comentario {
  #id;
  #ticketId;
  #autor;
  #texto;
  #creadoEn;

  constructor({ id = null, ticketId, autor, texto, creadoEn = null }) {
    if (typeof ticketId !== 'string' || !ticketId) throw new ErrorDeValidacion('Ticket requerido');
    if (!autor || !Number.isInteger(autor.id)) throw new ErrorDeValidacion('Autor inválido');
    this.#id = id;
    this.#ticketId = ticketId;
    this.#autor = Object.freeze({ id: autor.id, nombre: autor.nombre, rol: autor.rol });
    this.#texto = Comentario.#validarTexto(texto);
    this.#creadoEn = creadoEn;
  }

  static get LONGITUD_MAXIMA() { return LONGITUD_MAXIMA; }

  static #validarTexto(texto) {
    const limpio = typeof texto === 'string' ? texto.trim() : '';
    if (!limpio) throw new ErrorDeValidacion('El comentario no puede estar vacío');
    if (limpio.length > LONGITUD_MAXIMA) throw new ErrorDeValidacion(`El comentario no puede superar ${LONGITUD_MAXIMA} caracteres`);
    return limpio;
  }

  get id() { return this.#id; }

  get ticketId() { return this.#ticketId; }

  get autor() { return this.#autor; }

  get texto() { return this.#texto; }

  get creadoEn() { return this.#creadoEn; }

  // La persistencia devuelve una copia con id y fecha: la instancia original no cambia
  persistido(id, creadoEn) {
    return new Comentario({ id, ticketId: this.#ticketId, autor: this.#autor, texto: this.#texto, creadoEn });
  }

  aJSON() {
    return { id: this.#id, ticketId: this.#ticketId, texto: this.#texto, createdAt: this.#creadoEn, autor: { ...this.#autor } };
  }
}

module.exports = Comentario;
