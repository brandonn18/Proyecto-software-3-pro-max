// Quién puede ver y modificar qué ticket. `actor` es { id, rol } (claims del JWT).
const { ROLES } = require('./catalogos');
const { ErrorDominio, CODIGOS } = require('./errores');

const _denegar = (mensaje) => new ErrorDominio(CODIGOS.ACCESO_DENEGADO, mensaje);

const puedeVer = (ticket, actor) => {
  if (actor.rol === ROLES.ADMIN) return true;
  if (actor.rol === ROLES.TECNICO) return true;
  return ticket.usuarioId === actor.id;
};

const puedeCambiarEstado = (ticket, actor) => {
  if (actor.rol === ROLES.ADMIN) return true;
  return actor.rol === ROLES.TECNICO && ticket.tecnicoId === actor.id;
};

// Reabren el admin y el usuario dueño del ticket; el técnico no (tabla de permisos)
const puedeReabrir = (ticket, actor) => {
  if (actor.rol === ROLES.ADMIN) return true;
  return actor.rol === ROLES.USUARIO && ticket.usuarioId === actor.id;
};

// Filtro de listado: usuario ve los suyos, técnico los asignados, admin todos
const filtroDeListado = (actor) => {
  if (actor.rol === ROLES.USUARIO) return { usuarioId: actor.id };
  if (actor.rol === ROLES.TECNICO) return { tecnicoId: actor.id };
  return {};
};

const exigirVer = (ticket, actor) => {
  if (!puedeVer(ticket, actor)) throw _denegar('Sin acceso a este ticket');
};

const exigirCambiarEstado = (ticket, actor) => {
  if (!puedeCambiarEstado(ticket, actor)) throw _denegar('Sin permiso para modificar este ticket');
};

const exigirReabrir = (ticket, actor) => {
  if (!puedeReabrir(ticket, actor)) throw _denegar('Sin permiso para reabrir este ticket');
};

module.exports = {
  puedeVer, puedeCambiarEstado, puedeReabrir, filtroDeListado, exigirVer, exigirCambiarEstado, exigirReabrir,
};
