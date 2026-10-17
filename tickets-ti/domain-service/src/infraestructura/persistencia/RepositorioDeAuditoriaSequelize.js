// Implementación concreta de RepositorioDeAuditoria sobre Sequelize.
const { RepositorioDeAuditoria } = require('../../interfaces');
const EventoDeAuditoria = require('../../entidades/EventoDeAuditoria');

class RepositorioDeAuditoriaSequelize extends RepositorioDeAuditoria {
  #modelo;

  constructor({ AuditLog }) {
    super();
    if (!AuditLog) throw new Error('RepositorioDeAuditoriaSequelize requiere el modelo AuditLog');
    this.#modelo = AuditLog;
  }

  async registrar(evento) {
    await this.#modelo.create({
      ticketId: evento.ticketId, accion: evento.accion, detalle: evento.detalle,
      usuarioId: evento.actor?.id ?? null, usuario_nombre: evento.actor?.nombre ?? null,
    });
  }

  async listarPorTicket(ticketId) {
    const filas = await this.#modelo.findAll({ where: { ticketId }, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
    return filas.map((f) => new EventoDeAuditoria({
      id: f.id, ticketId: f.ticketId, accion: f.accion, detalle: f.detalle, creadoEn: f.createdAt,
      actor: f.usuarioId ? { id: f.usuarioId, nombre: f.usuario_nombre } : null,
    }));
  }
}

module.exports = RepositorioDeAuditoriaSequelize;
