// Objeto de valor DatosDeTicket: lo que el solicitante describe (título,
// descripción, tipo, categoría y prioridad), siempre válido e inmutable.
const { TIPOS, CATEGORIAS } = require('./catalogos');
const { ErrorDeValidacion } = require('../errores');
const Prioridad = require('./Prioridad');

const CAMPOS_EDITABLES = Object.freeze(['titulo', 'descripcion', 'tipo', 'categoria', 'prioridad']);

const _exigirTexto = (valor, campo) => {
  if (typeof valor !== 'string' || valor.trim() === '') throw new ErrorDeValidacion(`${campo} requerido`);
  return valor;
};

const _exigirEn = (valor, permitidos, campo) => {
  if (!permitidos.includes(valor)) throw new ErrorDeValidacion(`${campo} inválido: ${valor}`);
  return valor;
};

class DatosDeTicket {
  #titulo;
  #descripcion;
  #tipo;
  #categoria;
  #prioridad;

  constructor({ titulo, descripcion, tipo, categoria, prioridad = 'media' }) {
    this.#titulo = _exigirTexto(titulo, 'Título');
    this.#descripcion = _exigirTexto(descripcion, 'Descripción');
    this.#tipo = _exigirEn(tipo, TIPOS, 'Tipo');
    this.#categoria = _exigirEn(categoria, CATEGORIAS, 'Categoría');
    this.#prioridad = new Prioridad(prioridad);
  }

  get titulo() { return this.#titulo; }

  get descripcion() { return this.#descripcion; }

  get tipo() { return this.#tipo; }

  get categoria() { return this.#categoria; }

  get prioridad() { return this.#prioridad; }

  // Copia con los cambios permitidos; el resto de claves se ignora
  con(cambios) {
    const permitidos = Object.fromEntries(Object.entries(cambios).filter(([c, v]) => CAMPOS_EDITABLES.includes(c) && v !== undefined));
    return new DatosDeTicket({ ...this.aObjeto(), ...permitidos });
  }

  aObjeto() {
    return { titulo: this.#titulo, descripcion: this.#descripcion, tipo: this.#tipo, categoria: this.#categoria, prioridad: this.#prioridad.nombre };
  }
}

module.exports = DatosDeTicket;
