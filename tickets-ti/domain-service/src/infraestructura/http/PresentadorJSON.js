// Forma de las respuestas JSON (CLAUDE.md, "Estructura de respuesta API") y
// del JSON de cada entidad. Usuario/técnico salen del snapshot del ticket.
class PresentadorJSON {
  static exito(data, message = 'OK') {
    return { success: true, data, message };
  }

  static paginado(data, meta) {
    return { success: true, data, meta };
  }

  static error(message, errors = []) {
    return { success: false, message, errors };
  }

  static ticket(ticket) {
    const datos = ticket.aInstantanea();
    return {
      ...datos,
      usuario: { id: datos.usuarioId, nombre: datos.usuario_nombre },
      tecnico: datos.tecnicoId ? { id: datos.tecnicoId, nombre: datos.tecnico_nombre } : null,
    };
  }

  static detalle({ ticket, historial }) {
    return { ...PresentadorJSON.ticket(ticket), auditorias: historial.map((e) => e.aJSON()) };
  }
}

module.exports = PresentadorJSON;
