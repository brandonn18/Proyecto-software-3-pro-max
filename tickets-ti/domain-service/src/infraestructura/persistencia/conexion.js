const { Sequelize } = require('sequelize');

// Conexión a la base propia de domain-service.
// Nunca apunta a la base de authcore (CLAUDE.md, "Datos de usuario").
const crearSequelize = ({ database, username, password, host, port, ssl }, { logging = false } = {}) =>
  new Sequelize(database, username, password, {
    host,
    port,
    dialect: 'postgres',
    logging,
    dialectOptions: { ssl: ssl ? { require: true, rejectUnauthorized: false } : false },
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  });

module.exports = { crearSequelize };
