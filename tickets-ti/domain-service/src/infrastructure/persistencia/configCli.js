// Configuración para sequelize-cli (npm run migrate). La app usa db.js.
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false },
};

module.exports = { development: base, test: base, production: base };
