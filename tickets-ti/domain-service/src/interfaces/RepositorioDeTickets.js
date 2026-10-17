const { ErrorNoImplementado } = require('../errores');

/**
 * Interfaz (clase abstracta) RepositorioDeTickets. Persistencia de tickets. Trabaja con entidades Ticket.
 * Las implementaciones la extienden y sobrescriben cada método.
 *
 * buscarPorId(id)                              → Promise<Ticket|null>
 * contarDelAnio(anio)                          → Promise<number>  tickets con prefijo TKT-anio- (incluye eliminados)
 * guardarNuevo(ticket)                         → Promise<Ticket>  lanza ErrorIdDuplicado si el id ya existe
 * actualizar(ticket)                           → Promise<Ticket>
 * eliminar(id)                                 → Promise<void>    borrado lógico
 * listar({ filtros, paginacion })              → Promise<{ items: Ticket[], total }>  orden: createdAt DESC
 * contarCargaActiva({ tecnicoId, categoria? }) → Promise<number>  tickets no resueltos ni cerrados
 * listarPendientesDeAlertaSLA()                → Promise<Ticket[]> activos, con técnico, con límite y sin alerta enviada
 */
class RepositorioDeTickets {
  constructor() {
    if (new.target === RepositorioDeTickets) throw new TypeError('RepositorioDeTickets es abstracta');
  }

  async buscarPorId() { throw new ErrorNoImplementado(this, 'buscarPorId'); }

  async contarDelAnio() { throw new ErrorNoImplementado(this, 'contarDelAnio'); }

  async guardarNuevo() { throw new ErrorNoImplementado(this, 'guardarNuevo'); }

  async actualizar() { throw new ErrorNoImplementado(this, 'actualizar'); }

  async eliminar() { throw new ErrorNoImplementado(this, 'eliminar'); }

  async listar() { throw new ErrorNoImplementado(this, 'listar'); }

  async contarCargaActiva() { throw new ErrorNoImplementado(this, 'contarCargaActiva'); }

  async listarPendientesDeAlertaSLA() { throw new ErrorNoImplementado(this, 'listarPendientesDeAlertaSLA'); }
}

module.exports = RepositorioDeTickets;
