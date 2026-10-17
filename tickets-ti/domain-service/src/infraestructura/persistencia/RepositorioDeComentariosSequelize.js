// Implementación concreta de RepositorioDeComentarios sobre Sequelize.
const { RepositorioDeComentarios } = require('../../interfaces');
const Comentario = require('../../entidades/Comentario');

const ATRIBUTOS = ['id', 'ticketId', 'autorId', 'autor_nombre', 'autor_rol', 'texto', 'createdAt'];

class RepositorioDeComentariosSequelize extends RepositorioDeComentarios {
  #modelo;

  constructor({ TicketComentario }) {
    super();
    if (!TicketComentario) throw new Error('RepositorioDeComentariosSequelize requiere el modelo TicketComentario');
    this.#modelo = TicketComentario;
  }

  static #aEntidad(fila) {
    const autor = { id: fila.autorId, nombre: fila.autor_nombre, rol: fila.autor_rol };
    return new Comentario({ id: fila.id, ticketId: fila.ticketId, autor, texto: fila.texto, creadoEn: fila.createdAt });
  }

  // createdAt lo asigna la base de datos (igual que en el resto de tablas)
  async guardar(comentario) {
    if (comentario.id !== null) throw new Error('El comentario ya fue guardado');
    const { ticketId, texto, autor } = comentario;
    const fila = await this.#modelo.create({ ticketId, texto, autorId: autor.id, autor_nombre: autor.nombre, autor_rol: autor.rol });
    return comentario.persistido(fila.id, fila.createdAt);
  }

  async listarPorTicket(ticketId) {
    const filas = await this.#modelo.findAll({ attributes: ATRIBUTOS, where: { ticketId }, order: [['createdAt', 'ASC'], ['id', 'ASC']], raw: true });
    return filas.map((f) => RepositorioDeComentariosSequelize.#aEntidad(f));
  }
}

module.exports = RepositorioDeComentariosSequelize;
