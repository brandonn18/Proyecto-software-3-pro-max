// Capa de DATOS: hilo de comentarios de cada ticket.

const ATRIBUTOS = ['id', 'ticketId', 'autorId', 'autor_nombre', 'autor_rol', 'texto', 'createdAt'];

const _plano = (fila) => Object.fromEntries(ATRIBUTOS.map((campo) => [campo, fila.get(campo)]));

class ComentariosDAO {
  constructor({ TicketComentario }) {
    if (!TicketComentario) throw new Error('ComentariosDAO requiere el modelo TicketComentario');
    this.modelo = TicketComentario;
  }

  async listarPorTicket(ticketId) {
    const filas = await this.modelo.findAll({ attributes: ATRIBUTOS, where: { ticketId }, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
    return filas.map(_plano);
  }

  // createdAt lo asigna la base de datos
  async insertar({ ticketId, autorId, autor_nombre, autor_rol, texto }) {
    return _plano(await this.modelo.create({ ticketId, autorId, autor_nombre, autor_rol, texto }));
  }
}

module.exports = { ComentariosDAO };
