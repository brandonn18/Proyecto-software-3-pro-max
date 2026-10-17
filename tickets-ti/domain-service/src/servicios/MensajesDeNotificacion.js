// Textos de las notificaciones in-app (idénticos a los del monolito).
class MensajesDeNotificacion {
  static creacion(ticket) {
    return `Tu ticket ${ticket.id} "${ticket.titulo}" ha sido creado y será asignado a un técnico.`;
  }

  static asignacionAutomatica(ticket) {
    return `Se te ha asignado automáticamente el ticket ${ticket.id}: ${ticket.titulo}`;
  }

  static asignacion(ticket) {
    return `Se te ha asignado el ticket ${ticket.id}: ${ticket.titulo}`;
  }

  static resolucion(ticket) {
    return `Tu ticket ${ticket.id} ha sido resuelto.`;
  }

  static alertaSLA(ticket, porcentaje) {
    return `Alerta SLA: El ticket ${ticket.id} lleva el ${Math.round(porcentaje)}% del tiempo consumido. `
      + `Límite: ${ticket.ventanaSLA.limite.toLocaleString()}.`;
  }
}

module.exports = MensajesDeNotificacion;
