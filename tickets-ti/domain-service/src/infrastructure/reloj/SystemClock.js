const { Clock } = require('../../application/ports');

// Único lugar de domain-service que lee el reloj del sistema.
class SystemClock extends Clock {
  ahora() {
    return new Date();
  }
}

module.exports = SystemClock;
