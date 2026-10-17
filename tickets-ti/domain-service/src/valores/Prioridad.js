// Objeto de valor Prioridad: sabe cuántas horas de SLA le tocan por defecto.
const { PRIORIDADES } = require('./catalogos');
const { ErrorDeValidacion } = require('../errores');

const HORAS_POR_DEFECTO = Object.freeze({ critica: 4, alta: 8, media: 24, baja: 72 });
const HORAS_SIN_PRIORIDAD = 24;

class Prioridad {
  #nombre;

  constructor(nombre = 'media') {
    if (!PRIORIDADES.includes(nombre)) throw new ErrorDeValidacion(`Prioridad inválido: ${nombre}`);
    this.#nombre = nombre;
  }

  get nombre() { return this.#nombre; }

  // configuracion: ConfiguracionSLA de esta prioridad, si existe
  horasDeSLA(configuracion) {
    return configuracion?.tiempoHoras || Prioridad.horasPorDefecto(this.#nombre);
  }

  static horasPorDefecto(nombre) {
    return HORAS_POR_DEFECTO[nombre] || HORAS_SIN_PRIORIDAD;
  }

  toString() { return this.#nombre; }
}

module.exports = Prioridad;
