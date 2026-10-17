// Capa de NEGOCIO: quién lee y escribe el hilo de comentarios de un ticket.
// Leer: quien puede ver el ticket. Escribir: el administrador, el técnico
// asignado y el dueño; nadie comenta un ticket cerrado (hay que reabrirlo).
const { ROLES } = require('../../comun/catalogos');
const { ErrorDominio, CODIGOS, errorValidacion } = require('../../comun/errores');
const { puedeVer } = require('./politicaAcceso');

const LONGITUD_MAXIMA = 2000;

const validarTexto = (texto) => {
  const limpio = typeof texto === 'string' ? texto.trim() : '';
  if (!limpio) throw errorValidacion('El comentario no puede estar vacío');
  if (limpio.length > LONGITUD_MAXIMA) throw errorValidacion(`El comentario no puede superar ${LONGITUD_MAXIMA} caracteres`);
  return limpio;
};

const _participa = (ticket, actor) => {
  if (actor.rol === ROLES.ADMIN) return true;
  if (actor.rol === ROLES.TECNICO) return ticket.tecnicoId === actor.id;
  return ticket.usuarioId === actor.id;
};

const exigirLeer = (ticket, actor) => {
  if (!puedeVer(ticket, actor)) throw new ErrorDominio(CODIGOS.ACCESO_DENEGADO, 'Sin acceso a este ticket');
};

const exigirComentar = (ticket, actor) => {
  if (!_participa(ticket, actor)) {
    throw new ErrorDominio(CODIGOS.ACCESO_DENEGADO, 'Solo el solicitante, el técnico asignado o un administrador pueden comentar');
  }
  if (ticket.estado === 'cerrado') {
    throw new ErrorDominio(CODIGOS.TRANSICION_INVALIDA, 'No se puede comentar un ticket cerrado; reábrelo primero');
  }
};

module.exports = { LONGITUD_MAXIMA, validarTexto, exigirLeer, exigirComentar };
