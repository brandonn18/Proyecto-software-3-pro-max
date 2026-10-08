// Textos de las notificaciones in-app (idénticos a los del monolito).
module.exports = {
  creacion: (t) => `Tu ticket ${t.id} "${t.titulo}" ha sido creado y será asignado a un técnico.`,
  asignacionAutomatica: (t) => `Se te ha asignado automáticamente el ticket ${t.id}: ${t.titulo}`,
  asignacion: (t) => `Se te ha asignado el ticket ${t.id}: ${t.titulo}`,
  resolucion: (t) => `Tu ticket ${t.id} ha sido resuelto.`,
  alertaSLA: (t, porcentaje) =>
    `Alerta SLA: El ticket ${t.id} lleva el ${Math.round(porcentaje)}% del tiempo consumido. `
    + `Límite: ${new Date(t.sla_limite).toLocaleString()}.`,
};
