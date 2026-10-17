// MODELO TicketComentario: hilo de comentarios de un ticket. Leer: quien puede
// ver el ticket. Escribir: el administrador, el técnico asignado y el dueño;
// nadie comenta un ticket cerrado (hay que reabrirlo primero).
const { Model, DataTypes } = require('sequelize');
const { ROLES } = require('./apoyo/catalogos');
const { ErrorDominio, CODIGOS, errorValidacion } = require('./apoyo/errores');
const { Ticket } = require('./Ticket');

const LONGITUD_MAXIMA = 2000;
const ATRIBUTOS_PUBLICOS = ['id', 'ticketId', 'autorId', 'autor_nombre', 'autor_rol', 'texto', 'createdAt'];

const _validarTexto = (texto) => {
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

class TicketComentario extends Model {
  static async hiloDe(ticketId, actor) {
    const ticket = await Ticket.buscarOFallar(ticketId);
    ticket.exigirVer(actor);
    return this.hiloDeTicket(ticket);
  }

  // Sin control de acceso: lo usa el panel HTML, que ya exige rol administrador
  static hiloDeTicket(ticket) {
    return this.findAll({ attributes: ATRIBUTOS_PUBLICOS, where: { ticketId: ticket.id }, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
  }

  static async comentar(ticketId, actor, texto) {
    return this.comentarEn(await Ticket.buscarOFallar(ticketId), actor, texto);
  }

  // El autor se guarda como snapshot (id, nombre, rol) del token
  static comentarEn(ticket, actor, texto) {
    if (!_participa(ticket, actor)) {
      throw new ErrorDominio(CODIGOS.ACCESO_DENEGADO, 'Solo el solicitante, el técnico asignado o un administrador pueden comentar');
    }
    if (ticket.estado === 'cerrado') throw new ErrorDominio(CODIGOS.TRANSICION_INVALIDA, 'No se puede comentar un ticket cerrado; reábrelo primero');
    return this.create({ ticketId: ticket.id, autorId: actor.id, autor_nombre: actor.nombre, autor_rol: actor.rol, texto: _validarTexto(texto) });
  }
}

const ATRIBUTOS = {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ticketId: { type: DataTypes.STRING(20), allowNull: false },
  autorId: { type: DataTypes.INTEGER, allowNull: false },
  autor_nombre: { type: DataTypes.STRING(100), allowNull: false },
  autor_rol: { type: DataTypes.STRING(20), allowNull: false },
  texto: { type: DataTypes.TEXT, allowNull: false },
};

// La FK hacia tickets la crea la migración 20261015000001
const iniciar = (sequelize) => TicketComentario.init(ATRIBUTOS, {
  sequelize, modelName: 'TicketComentario', tableName: 'ticket_comentarios', timestamps: true, paranoid: true, indexes: [{ fields: ['ticketId'] }],
});

module.exports = { TicketComentario, iniciar, LONGITUD_MAXIMA };
