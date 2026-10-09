// Conexión a tickets_domain_test con los modelos definidos y el esquema recreado.
const { crearSequelize, definirModelos, configDB } = require('../../src/infrastructure');

const abrirBdDePrueba = async () => {
  const sequelize = crearSequelize(configDB());
  const modelos = definirModelos(sequelize);
  await sequelize.sync({ force: true });
  const limpiar = () => sequelize.query('TRUNCATE tickets, audit_logs, notifications, sla_configs RESTART IDENTITY CASCADE');
  return { sequelize, modelos, limpiar, cerrar: () => sequelize.close() };
};

module.exports = { abrirBdDePrueba };
