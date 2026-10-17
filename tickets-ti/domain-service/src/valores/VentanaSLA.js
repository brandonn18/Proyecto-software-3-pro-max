// Objeto de valor VentanaSLA: hasta cuándo hay que resolver un ticket.
// Inmutable: reiniciar el SLA crea una ventana nueva.
const MS_POR_HORA = 60 * 60 * 1000;
const PORCENTAJE_ALERTA_POR_DEFECTO = 80;

class VentanaSLA {
  #limite;

  constructor(limite) {
    this.#limite = limite ? new Date(limite) : null;
  }

  static desde(ahora, horas) {
    return new VentanaSLA(new Date(ahora.getTime() + horas * MS_POR_HORA));
  }

  get limite() { return this.#limite; }

  // El inicio se deriva del límite (no de createdAt) para que una reapertura
  // cuente el SLA desde que se reabrió y no desde que se creó el ticket.
  porcentajeConsumido(ahora, horas) {
    const totalMs = horas * MS_POR_HORA;
    const inicioMs = this.#limite.getTime() - totalMs;
    const porcentaje = ((ahora.getTime() - inicioMs) / totalMs) * 100;
    return Math.min(Math.max(porcentaje, 0), 100);
  }

  vencidaEn(ahora) {
    return ahora > this.#limite;
  }

  static get porcentajeAlertaPorDefecto() { return PORCENTAJE_ALERTA_POR_DEFECTO; }
}

module.exports = VentanaSLA;
