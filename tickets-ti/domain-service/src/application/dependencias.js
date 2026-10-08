const { verificarPuerto } = require('./ports');
const { ErrorDominio, CODIGOS } = require('../domain/errores');

// Verifica en el constructor que cada dependencia cumpla su puerto (fail fast).
// mapa: { nombreDependencia: Puerto }
const requerirDependencias = (deps, mapa) => {
  Object.entries(mapa).forEach(([nombre, Puerto]) => verificarPuerto(deps?.[nombre], Puerto, nombre));
  return deps;
};

const loggerPorDefecto = { error: (...args) => console.error(...args) };

// Efectos secundarios no críticos (emails): un fallo se registra pero no
// revierte la operación principal, igual que en el monolito.
const enSegundoPlano = (logger, contexto, tarea) => {
  Promise.resolve()
    .then(tarea)
    .catch((err) => logger.error(`[${contexto}]`, err.message));
};

const noEncontrado = (mensaje) => new ErrorDominio(CODIGOS.NO_ENCONTRADO, mensaje);

const ticketOFallar = async (ticketRepository, id) => {
  const ticket = await ticketRepository.buscarPorId(id);
  if (!ticket) throw noEncontrado('Ticket no encontrado');
  return ticket;
};

module.exports = { requerirDependencias, loggerPorDefecto, enSegundoPlano, noEncontrado, ticketOFallar };
