// Capa de PRESENTACIÓN: limpieza de la entrada y forma del JSON de salida.
const sanitizeHtml = require('sanitize-html');

// Entrada: elimina todo HTML de los textos libres antes de llegar a negocio.
const sanitizarTexto = (texto) => {
  if (typeof texto !== 'string') return texto;
  return sanitizeHtml(texto, { allowedTags: [], allowedAttributes: {} }).trim();
};

// Salida: el JSON de un ticket con la forma que usa el frontend.
// usuario/tecnico salen del snapshot: no se consulta authcore al responder.
const presentarTicket = (fila) => {
  const { deletedAt, ...datos } = fila;
  return {
    ...datos,
    usuario: { id: datos.usuarioId, nombre: datos.usuario_nombre },
    tecnico: datos.tecnicoId ? { id: datos.tecnicoId, nombre: datos.tecnico_nombre } : null,
  };
};

const presentarDetalle = ({ ticket, auditorias }) => ({ ...presentarTicket(ticket), auditorias });

const presentarComentario = (fila) => ({
  id: fila.id,
  ticketId: fila.ticketId,
  texto: fila.texto,
  createdAt: fila.createdAt,
  autor: { id: fila.autorId, nombre: fila.autor_nombre, rol: fila.autor_rol },
});

module.exports = { sanitizarTexto, presentarTicket, presentarDetalle, presentarComentario };
