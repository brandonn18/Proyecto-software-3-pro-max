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

// casos: { verificarSLA, publicarEstadisticas } | cron inyectable para tests
const programarTareas = ({ casos, logger = console, cron = cronPorDefecto }) => [
  cron.schedule(CADA_15_MIN, _tarea('SLA', () => casos.verificarSLA.ejecutar(), logger)),
  cron.schedule(CADA_5_MIN, _tarea('Estadísticas', () => casos.publicarEstadisticas.ejecutar(), logger)),
];

module.exports = { programarTareas, CADA_15_MIN, CADA_5_MIN };
