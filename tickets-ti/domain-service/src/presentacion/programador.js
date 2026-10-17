// Capa de PRESENTACIÓN: punto de entrada por tiempo (cron), igual que HTTP lo
// es por petición. Solo llama a servicios de negocio.
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

// servicios: { sla, reportes } | cron inyectable para tests
const programarTareas = ({ servicios, logger = console, cron = cronPorDefecto }) => [
  cron.schedule(CADA_15_MIN, _tarea('SLA', () => servicios.sla.verificar(), logger)),
  cron.schedule(CADA_5_MIN, _tarea('Estadísticas', () => servicios.reportes.publicarEstadisticas(), logger)),
];

module.exports = { programarTareas, CADA_15_MIN, CADA_5_MIN };
