// Los seis estados concretos del ciclo de vida. Cargar este archivo los
// registra en EstadoDeTicket.desde().
const { ESTADOS } = require('../../valores/catalogos');
const EstadoDeTicket = require('./EstadoDeTicket');

class Abierto extends EstadoDeTicket {
  get nombre() { return 'abierto'; }

  get siguientes() { return ['asignado']; }
}

class Asignado extends EstadoDeTicket {
  get nombre() { return 'asignado'; }

  get siguientes() { return ['en_proceso']; }
}

class EnProceso extends EstadoDeTicket {
  get nombre() { return 'en_proceso'; }

  get siguientes() { return ['en_espera', 'resuelto']; }
}

class EnEspera extends EstadoDeTicket {
  get nombre() { return 'en_espera'; }

  get siguientes() { return ['en_proceso']; }
}

class Resuelto extends EstadoDeTicket {
  get nombre() { return 'resuelto'; }

  get siguientes() { return ['cerrado', 'abierto']; }

  esFinal() { return true; }
}

// Cerrado es el único estado que no admite comentarios: hay que reabrirlo
class Cerrado extends EstadoDeTicket {
  get nombre() { return 'cerrado'; }

  get siguientes() { return ['abierto']; }

  esFinal() { return true; }

  permiteComentar() { return false; }
}

[Abierto, Asignado, EnProceso, EnEspera, Resuelto, Cerrado].forEach((Clase) => EstadoDeTicket.registrar(Clase));

// Nombres de los estados finales, preguntándole a cada estado (para las consultas SQL)
const ESTADOS_FINALES = Object.freeze(ESTADOS.filter((nombre) => EstadoDeTicket.desde(nombre).esFinal()));

module.exports = { EstadoDeTicket, Abierto, Asignado, EnProceso, EnEspera, Resuelto, Cerrado, ESTADOS_FINALES };
