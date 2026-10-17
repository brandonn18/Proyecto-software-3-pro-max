// Colaboradores externos que usan los modelos: directorio de authcore, SMTP,
// Socket.io, reloj y logger. Se configuran una vez al arrancar (server.js) y
// los tests los reemplazan por dobles con configurarServicios().
const servicios = {
  directorio: null,
  correo: null,
  tiempoReal: null,
  reloj: { ahora: () => new Date() },
  logger: { error: (...args) => console.error(...args), info: () => {} },
};

const configurarServicios = (nuevos) => Object.assign(servicios, nuevos);

// Efectos secundarios no críticos (emails): un fallo se registra pero no
// revierte la operación principal, igual que en el monolito.
const enSegundoPlano = (contexto, tarea) => {
  Promise.resolve()
    .then(tarea)
    .catch((err) => servicios.logger.error(`[${contexto}]`, err.message));
};

module.exports = { servicios, configurarServicios, enSegundoPlano };
