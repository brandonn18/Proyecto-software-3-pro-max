// Objeto de valor IdTicket: TKT-YYYY-NNNN, correlativo por año. Inmutable;
// dos IdTicket con el mismo texto son iguales.
const { ErrorDeValidacion } = require('../errores');

const PATRON = /^TKT-(\d{4})-(\d{4,})$/;

class IdTicket {
  #valor;

  constructor(valor) {
    if (!IdTicket.esValido(valor)) throw new ErrorDeValidacion(`ID de ticket inválido: ${valor}`);
    this.#valor = valor;
  }

  static esValido(valor) {
    return typeof valor === 'string' && PATRON.test(valor);
  }

  static prefijoDelAnio(anio) {
    return `TKT-${anio}-`;
  }

  static del(anio, correlativo) {
    if (!Number.isInteger(anio) || anio < 1000 || anio > 9999) throw new ErrorDeValidacion(`Año inválido: ${anio}`);
    if (!Number.isInteger(correlativo) || correlativo < 1) throw new ErrorDeValidacion(`Correlativo inválido: ${correlativo}`);
    return new IdTicket(`${IdTicket.prefijoDelAnio(anio)}${String(correlativo).padStart(4, '0')}`);
  }

  equals(otro) {
    return otro instanceof IdTicket && otro.toString() === this.#valor;
  }

  toString() {
    return this.#valor;
  }
}

module.exports = IdTicket;
