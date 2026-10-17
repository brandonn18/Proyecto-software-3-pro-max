// Subclases concretas de Actor y la fábrica que elige cuál instanciar.
const Actor = require('./Actor');
const { ROLES } = require('../../valores/catalogos');
const { ErrorDeValidacion } = require('../../errores');

class Administrador extends Actor {
  get rol() { return ROLES.ADMIN; }

  puedeVer() { return true; }

  puedeCambiarEstado() { return true; }

  puedeReabrir() { return true; }

  puedeComentar() { return true; }

  filtroDeListado() { return {}; }
}

// Cualquier técnico ve todos los tickets, pero solo trabaja los suyos
class Tecnico extends Actor {
  get rol() { return ROLES.TECNICO; }

  puedeVer() { return true; }

  puedeCambiarEstado(ticket) { return this.esTecnicoDe(ticket); }

  puedeReabrir() { return false; }

  puedeComentar(ticket) { return this.esTecnicoDe(ticket); }

  filtroDeListado() { return { tecnicoId: this.id }; }
}

class Solicitante extends Actor {
  get rol() { return ROLES.USUARIO; }

  puedeVer(ticket) { return this.esDuenioDe(ticket); }

  puedeCambiarEstado() { return false; }

  puedeReabrir(ticket) { return this.esDuenioDe(ticket); }

  puedeComentar(ticket) { return this.esDuenioDe(ticket); }

  filtroDeListado() { return { usuarioId: this.id }; }
}

const CLASE_POR_ROL = Object.freeze({ [ROLES.ADMIN]: Administrador, [ROLES.TECNICO]: Tecnico, [ROLES.USUARIO]: Solicitante });

// Patrón Factory: { id, nombre, rol } → la subclase que corresponde
class FabricaDeActores {
  static crear({ id, nombre, rol }) {
    const Clase = CLASE_POR_ROL[rol];
    if (!Clase) throw new ErrorDeValidacion(`Rol inválido: ${rol}`);
    return new Clase({ id, nombre });
  }
}

module.exports = { Actor, Administrador, Tecnico, Solicitante, FabricaDeActores };
