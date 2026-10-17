// "Rutas" por tiempo: cada expresión cron apunta a una acción del controlador
// de tareas, igual que cada path HTTP apunta a una acción de su controlador.
const cronPorDefecto = require('node-cron');

const CADA_15_MIN = '*/15 * * * *';
const CADA_5_MIN = '*/5 * * * *';

// Una tarea que falla se registra y no detiene el programador
const _tarea = (nombre, fn, logger) => async () => {
  try {
    const resultado = await fn();
    if (nombre === 'SLA' && resultado > 0) logger.info?.(`[SLA] ${resultado} alerta(s) generadas`);
  } catch (err) {
    logger.error(`[${nombre}] error:`, err.message);
  }
};

// ctrl: crearTareasController(...) | cron inyectable para tests
const programarTareas = ({ ctrl, logger = console, cron = cronPorDefecto }) => [
  cron.schedule(CADA_15_MIN, _tarea('SLA', () => ctrl.verificarSLA(), logger)),
  cron.schedule(CADA_5_MIN, _tarea('Estadísticas', () => ctrl.publicarEstadisticas(), logger)),
];

module.exports = { programarTareas, CADA_15_MIN, CADA_5_MIN };
