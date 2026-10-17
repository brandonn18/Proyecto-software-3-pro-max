// Utilidades compartidas por los servicios de la capa de NEGOCIO.
const { noEncontrado } = require('../../comun/errores');

const relojDelSistema = Object.freeze({ ahora: () => new Date() });

const loggerPorDefecto = { error: (...args) => console.error(...args) };

// Efectos secundarios no críticos (emails): un fallo se registra pero no
// revierte la operación principal, igual que en el monolito.
const enSegundoPlano = (logger, contexto, tarea) => {
  Promise.resolve()
    .then(tarea)
    .catch((err) => logger.error(`[${contexto}]`, err.message));
};

const ticketOFallar = async (ticketsDAO, id) => {
  const ticket = await ticketsDAO.buscarPorId(id);
  if (!ticket) throw noEncontrado('Ticket no encontrado');
  return ticket;
};

module.exports = { relojDelSistema, loggerPorDefecto, enSegundoPlano, ticketOFallar };
