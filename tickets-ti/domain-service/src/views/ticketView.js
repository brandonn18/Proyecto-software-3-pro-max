// VISTA: JSON de un ticket con la forma que usa el frontend. usuario/tecnico
// salen del snapshot: no se consulta authcore al responder.
const { plano } = require('./plano');

const ticket = (registro) => {
  const { deletedAt, ...datos } = plano(registro);
  return {
    ...datos,
    usuario: { id: datos.usuarioId, nombre: datos.usuario_nombre },
    tecnico: datos.tecnicoId ? { id: datos.tecnicoId, nombre: datos.tecnico_nombre } : null,
  };
};

const registroDeAuditoria = (registro) => {
  const fila = plano(registro);
  return {
    id: fila.id,
    accion: fila.accion,
    detalle: fila.detalle,
    createdAt: fila.createdAt,
    usuario: fila.usuarioId ? { id: fila.usuarioId, nombre: fila.usuario_nombre } : null,
  };
};

// Detalle: el ticket y su historial en orden cronológico
const detalle = (registro, auditorias) => ({ ...ticket(registro), auditorias: auditorias.map(registroDeAuditoria) });

module.exports = { ticket, detalle, registroDeAuditoria };
