// VISTA: JSON de un comentario. El autor sale del snapshot guardado.
const { plano } = require('./plano');

const comentario = (registro) => {
  const c = plano(registro);
  return {
    id: c.id,
    ticketId: c.ticketId,
    texto: c.texto,
    createdAt: c.createdAt,
    autor: { id: c.autorId, nombre: c.autor_nombre, rol: c.autor_rol },
  };
};

module.exports = { comentario };
