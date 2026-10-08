const { AuditoriaRepository } = require('../../application/ports');

const _aRegistro = (fila) => ({
  id: fila.id,
  accion: fila.accion,
  detalle: fila.detalle,
  createdAt: fila.createdAt,
  usuario: fila.usuarioId ? { id: fila.usuarioId, nombre: fila.usuario_nombre } : null,
});

class SequelizeAuditoriaRepository extends AuditoriaRepository {
  constructor({ AuditLog }) {
    super();
    this.modelo = AuditLog;
  }

  async registrar({ ticketId, actor, accion, detalle }) {
    await this.modelo.create({
      ticketId, accion, detalle, usuarioId: actor?.id ?? null, usuario_nombre: actor?.nombre ?? null,
    });
  }

  async listarPorTicket(ticketId) {
    const filas = await this.modelo.findAll({ where: { ticketId }, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
    return filas.map(_aRegistro);
  }
}

module.exports = SequelizeAuditoriaRepository;
