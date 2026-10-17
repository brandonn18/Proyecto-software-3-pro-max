require('dotenv').config();
const http = require('http');
const env = require('./src/config/env');
const { crearSequelize } = require('./src/config/baseDeDatos');
const { definirModelos, configurarServicios } = require('./src/models');
const DirectorioAuthcore = require('./src/lib/authcore/DirectorioAuthcore');
const { CorreoSMTP, crearTransporterSMTP, transporterNulo } = require('./src/lib/correo');
const { TiempoRealSocketIo } = require('./src/lib/tiempoReal');
const { crearApp } = require('./src/app');
const { crearTareasController } = require('./src/controllers/tareas.controller');
const { programarTareas } = require('./src/routes/tareas');

const _crearCorreo = () => {
  const transporter = process.env.EMAIL_HOST
    ? crearTransporterSMTP({
      host: process.env.EMAIL_HOST, port: process.env.EMAIL_PORT, user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS,
    })
    : transporterNulo;
  return new CorreoSMTP({ transporter, remitente: process.env.EMAIL_USER });
};

const iniciar = async () => {
  const jwtSecret = env.requerirEnv('JWT_SECRET');
  const origenPermitido = process.env.FRONTEND_URL || 'http://localhost:3000';
  const sequelize = crearSequelize(env.configDB(), { logging: process.env.NODE_ENV === 'development' && console.log });
  const modelos = definirModelos(sequelize);
  await sequelize.authenticate();
  // En producción el esquema lo manejan las migraciones (npm run migrate)
  if (process.env.NODE_ENV === 'development') await sequelize.sync({ alter: true });

  const tiempoReal = new TiempoRealSocketIo({ jwtSecret, origenPermitido });
  configurarServicios({ tiempoReal, correo: _crearCorreo(), directorio: new DirectorioAuthcore(env.configAuthcore()), logger: console });
  const trustProxy = parseInt(process.env.TRUST_PROXY || '0', 10);
  const server = http.createServer(crearApp({ modelos, jwtSecret, modulos: env.modulosHabilitados(), origenPermitido, trustProxy }));
  tiempoReal.adjuntar(server);
  programarTareas({ ctrl: crearTareasController(modelos, { tiempoReal }) });

  const puerto = process.env.PORT || 3003;
  server.listen(puerto, () => console.log(`domain-service escuchando en el puerto ${puerto}`));
};

iniciar().catch((error) => {
  console.error('domain-service: no se pudo iniciar:', error.message);
  process.exit(1);
});
