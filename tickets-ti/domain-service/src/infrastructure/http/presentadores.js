const sanitizeHtml = require('sanitize-html');

// Entrada: elimina todo HTML de los textos libres antes de llegar al dominio.
const sanitizarTexto = (texto) => {
  if (typeof texto !== 'string') return texto;
  return sanitizeHtml(texto, { allowedTags: [], allowedAttributes: {} }).trim();
};

// Salida: arma el JSON de un ticket con la forma que usa el frontend.
// usuario/tecnico salen del snapshot: no se consulta authcore al responder.
const presentarTicket = (ticket) => {
  const { deletedAt, ...datos } = ticket.aPrimitivos();
  return {
    ...datos,
    usuario: { id: datos.usuarioId, nombre: datos.usuario_nombre },
    tecnico: datos.tecnicoId ? { id: datos.tecnicoId, nombre: datos.tecnico_nombre } : null,
  };
};

const presentarDetalle = ({ ticket, auditorias }) => ({ ...presentarTicket(ticket), auditorias });

module.exports = { sanitizarTexto, presentarTicket, presentarDetalle };
