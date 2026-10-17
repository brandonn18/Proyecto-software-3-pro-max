// Conexión a tickets_domain_test con los modelos definidos y el esquema recreado.
const { crearSequelize } = require('../../src/infraestructura/persistencia/conexion');
const { definirModelos } = require('../../src/infraestructura/persistencia/modelosSequelize');
const Entorno = require('../../src/infraestructura/configuracion/Entorno');

const abrirBdDePrueba = async () => {
  const sequelize = crearSequelize(Entorno.baseDeDatos());
  const modelos = definirModelos(sequelize);
  await sequelize.sync({ force: true });
  const limpiar = () => sequelize.query('TRUNCATE tickets, audit_logs, notifications, sla_configs, ticket_comentarios RESTART IDENTITY CASCADE');
  return { sequelize, modelos, limpiar, cerrar: () => sequelize.close() };
};

module.exports = { abrirBdDePrueba };
