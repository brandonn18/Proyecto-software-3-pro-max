// Programador de tareas periódicas con node-cron (inyectable para tests).
const cronPorDefecto = require('node-cron');

class ProgramadorDeTareas {
  static CADA_15_MIN = '*/15 * * * *';

  static CADA_5_MIN = '*/5 * * * *';

  #tareas;
  #logger;
  #cron;

  // tareas: { verificarSLA: () => Promise<number>, publicarEstadisticas: () => Promise }
  constructor({ tareas, logger = console, cron = cronPorDefecto }) {
    this.#tareas = tareas;
    this.#logger = logger;
    this.#cron = cron;
  }

  // Una tarea que falla se registra y no detiene el programador
  #envolver(nombre, fn) {
    return async () => {
      try {
        const resultado = await fn();
        if (nombre === 'SLA' && resultado > 0) this.#logger.info?.(`[SLA] ${resultado} alerta(s) generadas`);
      } catch (err) {
        this.#logger.error(`[${nombre}] error:`, err.message);
      }
    };
  }

  programar() {
    return [
      this.#cron.schedule(ProgramadorDeTareas.CADA_15_MIN, this.#envolver('SLA', () => this.#tareas.verificarSLA())),
      this.#cron.schedule(ProgramadorDeTareas.CADA_5_MIN, this.#envolver('Estadísticas', () => this.#tareas.publicarEstadisticas())),
    ];
  }
}

module.exports = ProgramadorDeTareas;
