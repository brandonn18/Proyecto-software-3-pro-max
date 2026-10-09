// Bootstrap del administrador en producción (AWS). Lo ejecuta la tarea ECS
// "admin" después de las migraciones. ADMIN_PASSWORD viene de Secrets Manager.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { sequelize } = require('../models');
const { requerirEnv } = require('../config/env');
const { asegurarAdministrador } = require('../services/bootstrapService');

const ejecutar = async () => {
  const email = requerirEnv('ADMIN_EMAIL');
  const { creado } = await asegurarAdministrador({ email, password: requerirEnv('ADMIN_PASSWORD') });
  console.log(creado ? `authcore: administrador ${email} creado.` : `authcore: ${email} ya existía, sin cambios.`);
};

ejecutar()
  .catch((err) => {
    console.error('authcore: no se pudo crear el administrador:', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
