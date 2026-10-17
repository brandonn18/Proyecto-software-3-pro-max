// Entidad ConfiguracionSLA: horas y porcentaje de alerta de una prioridad.
// Solo tiempo_horas y porcentaje_alerta son editables; la prioridad no cambia
// (en el monolito se podía vía req.body).
const { ErrorDeValidacion } = require('../errores');
const VentanaSLA = require('../valores/VentanaSLA');

const _enteroEnRango = (valor, campo, min, max) => {
  if (!Number.isInteger(valor) || valor < min || valor > max) {
    throw new ErrorDeValidacion(`${campo} debe ser un entero entre ${min} y ${max}`);
  }
  return valor;
};

class ConfiguracionSLA {
  #id;
  #prioridad;
  #tiempoHoras;
  #porcentajeAlerta;
  #creadoEn;
  #actualizadoEn;

  constructor({ id, prioridad, tiempo_horas, porcentaje_alerta = VentanaSLA.porcentajeAlertaPorDefecto, createdAt = null, updatedAt = null }) {
    this.#id = id;
    this.#prioridad = prioridad;
    this.#tiempoHoras = tiempo_horas;
    this.#porcentajeAlerta = porcentaje_alerta;
    this.#creadoEn = createdAt;
    this.#actualizadoEn = updatedAt;
  }

  get id() { return this.#id; }

  get prioridad() { return this.#prioridad; }

  get tiempoHoras() { return this.#tiempoHoras; }

  get porcentajeAlerta() { return this.#porcentajeAlerta; }

  // Valida primero y cambia después: si algo es inválido, no cambia nada
  ajustar({ tiempo_horas, porcentaje_alerta }) {
    const horas = tiempo_horas === undefined ? this.#tiempoHoras : _enteroEnRango(tiempo_horas, 'tiempo_horas', 1, 8760);
    const porcentaje = porcentaje_alerta === undefined ? this.#porcentajeAlerta : _enteroEnRango(porcentaje_alerta, 'porcentaje_alerta', 1, 100);
    this.#tiempoHoras = horas;
    this.#porcentajeAlerta = porcentaje;
  }

  aJSON() {
    return {
      id: this.#id, prioridad: this.#prioridad, tiempo_horas: this.#tiempoHoras, porcentaje_alerta: this.#porcentajeAlerta,
      createdAt: this.#creadoEn, updatedAt: this.#actualizadoEn,
    };
  }
}

module.exports = ConfiguracionSLA;
