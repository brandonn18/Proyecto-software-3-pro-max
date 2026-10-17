// VISTA: página de error (ticket inexistente, sin permiso, etc.).
const { escapar, layout } = require('./layout');

const errorView = ({ mensaje }) => layout({
  titulo: 'No se pudo mostrar el ticket',
  cuerpo: `<h1>No se pudo mostrar el ticket</h1>\n<p role="alert">${escapar(mensaje)}</p>`,
});

module.exports = { errorView };
