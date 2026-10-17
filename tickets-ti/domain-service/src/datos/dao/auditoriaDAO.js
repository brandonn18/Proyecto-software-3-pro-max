// Capa de DATOS: bitácora de acciones. El nombre del actor se guarda como
// snapshot para no consultar authcore al mostrar el historial.

const _aRegistro = (fila) => ({
  id: fila.id,
  accion: fila.accion,
  detalle: fila.detalle,
  createdAt: fila.createdAt,
  usuario: fila.usuarioId ? { id: fila.usuarioId, nombre: fila.usuario_nombre } : null,
});

class AuditoriaDAO {
  constructor({ AuditLog }) {
    if (!AuditLog) throw new Error('AuditoriaDAO requiere el modelo AuditLog');
    this.modelo = AuditLog;
  }

  async registrar({ ticketId, actor, accion, detalle }) {
    await this.modelo.create({ ticketId, accion, detalle, usuarioId: actor?.id ?? null, usuario_nombre: actor?.nombre ?? null });
  }

  async listarPorTicket(ticketId) {
    const filas = await this.modelo.findAll({ where: { ticketId }, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
    return filas.map(_aRegistro);
  }
}

module.exports = { AuditoriaDAO };
