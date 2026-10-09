// Reglas de SLA: horas por prioridad, cálculo del límite y evaluación de alerta.
const { ESTADOS_FINALES } = require('./catalogos');

const HORAS_POR_DEFECTO = Object.freeze({ critica: 4, alta: 8, media: 24, baja: 72 });
const HORAS_SIN_PRIORIDAD = 24;
const PORCENTAJE_ALERTA_POR_DEFECTO = 80;
const MS_POR_HORA = 60 * 60 * 1000;

// `config` es la fila de SLAConfig de esa prioridad, si existe
const horasPara = (prioridad, config) =>
  config?.tiempo_horas || HORAS_POR_DEFECTO[prioridad] || HORAS_SIN_PRIORIDAD;

const calcularLimite = (ahora, horas) => new Date(ahora.getTime() + horas * MS_POR_HORA);

// El inicio se deriva del límite (no de createdAt) para que una reapertura
// cuente el SLA desde que se reabrió y no desde que se creó el ticket.
const _porcentajeConsumido = (slaLimite, horas, ahora) => {
  const totalMs = horas * MS_POR_HORA;
  const inicioMs = new Date(slaLimite).getTime() - totalMs;
  const porcentaje = ((ahora.getTime() - inicioMs) / totalMs) * 100;
  return Math.min(Math.max(porcentaje, 0), 100);
};

const evaluar = (ticket, { ahora, horas, porcentajeAlerta = PORCENTAJE_ALERTA_POR_DEFECTO }) => {
  const porcentaje = _porcentajeConsumido(ticket.sla_limite, horas, ahora);
  const vencido = ahora > new Date(ticket.sla_limite);
  const activo = !ESTADOS_FINALES.includes(ticket.estado);
  const alertar = activo && Boolean(ticket.tecnicoId) && !ticket.sla_alerta_enviada && porcentaje >= porcentajeAlerta;
  return { porcentaje, vencido, alertar };
};

module.exports = { HORAS_POR_DEFECTO, PORCENTAJE_ALERTA_POR_DEFECTO, horasPara, calcularLimite, evaluar };
