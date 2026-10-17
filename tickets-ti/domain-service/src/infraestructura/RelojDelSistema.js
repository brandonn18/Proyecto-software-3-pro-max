// Implementación concreta de Reloj: único lugar que lee el reloj del sistema.
const { Reloj } = require('../interfaces');

class RelojDelSistema extends Reloj {
  ahora() {
    return new Date();
  }
}

module.exports = RelojDelSistema;
