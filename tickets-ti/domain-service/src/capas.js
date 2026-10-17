// Apila las capas de abajo hacia arriba: datos → negocio. La presentación
// (presentacion/app.js y presentacion/programador.js) recibe solo los
// servicios de negocio. Los tests usan esta función con dobles de las
// integraciones externas (authcore, SMTP, Socket.io).
const { crearDAOs } = require('./datos');
const { crearServicios } = require('./negocio');

// integraciones: { directorio, correo, tiempoReal } | reloj? | logger?
const apilarCapas = ({ sequelize, modelos, directorio, correo, tiempoReal, jwtSecret, reloj, logger }) => {
  const dao = crearDAOs(modelos, sequelize);
  return { dao, servicios: crearServicios({ dao, directorio, correo, tiempoReal, jwtSecret, reloj, logger }) };
};

module.exports = { apilarCapas };
