require('dotenv').config();
const http = require('http');
const env = require('./src/comun/env');
const datos = require('./src/datos');
const { apilarCapas } = require('./src/capas');
const { crearApp } = require('./src/presentacion/app');
const { programarTareas } = require('./src/presentacion/programador');

const _crearCorreo = () => {
  const transporter = process.env.EMAIL_HOST
    ? datos.crearTransporterSMTP({
      host: process.env.EMAIL_HOST, port: process.env.EMAIL_PORT, user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS,
    })
    : datos.transporterNulo;
  return new datos.CorreoSMTP({ transporter, remitente: process.env.EMAIL_USER });
};

const iniciar = async () => {
  const jwtSecret = env.requerirEnv('JWT_SECRET');
  const origenPermitido = process.env.FRONTEND_URL || 'http://localhost:3000';
  const sequelize = datos.crearSequelize(env.configDB(), { logging: process.env.NODE_ENV === 'development' && console.log });
  const modelos = datos.definirModelos(sequelize);
  await sequelize.authenticate();
  // En producción el esquema lo manejan las migraciones (npm run migrate)
  if (process.env.NODE_ENV === 'development') await sequelize.sync({ alter: true });

  const tiempoReal = new datos.TiempoRealSocketIo({ jwtSecret, origenPermitido });
  const { servicios } = apilarCapas({
    sequelize, modelos, tiempoReal, jwtSecret, correo: _crearCorreo(), directorio: new datos.DirectorioAuthcore(env.configAuthcore()),
  });
  const trustProxy = parseInt(process.env.TRUST_PROXY || '0', 10);
  const server = http.createServer(crearApp({ servicios, modulos: env.modulosHabilitados(), origenPermitido, trustProxy }));
  tiempoReal.adjuntar(server);
  programarTareas({ servicios });

  const puerto = process.env.PORT || 3003;
  server.listen(puerto, () => console.log(`domain-service escuchando en el puerto ${puerto}`));
};

iniciar().catch((error) => {
  console.error('domain-service: no se pudo iniciar:', error.message);
  process.exit(1);
});
