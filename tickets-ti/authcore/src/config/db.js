const { Sequelize } = require('sequelize');
const { requerirEnv } = require('./env');

const sequelize = new Sequelize(
  requerirEnv('DB_NAME'),
  requerirEnv('DB_USER'),
  requerirEnv('DB_PASSWORD'),
  {
    host: requerirEnv('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false,
    },
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  }
);

module.exports = { sequelize };
