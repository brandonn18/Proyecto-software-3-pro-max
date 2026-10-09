require('dotenv').config();
const http = require('http');
const infra = require('./src/infrastructure');
const { componer } = require('./src/composicion');
const { crearApp } = require('./src/infrastructure/http/app');
const { programarTareas } = require('./src/infrastructure/programador');

const _crearEmail = () => {
  const transporter = process.env.EMAIL_HOST
    ? infra.crearTransporterSMTP({
      host: process.env.EMAIL_HOST, port: process.env.EMAIL_PORT, user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS,
    })
    : infra.transporterNulo;
  return new infra.NodemailerEmailAdapter({ transporter, remitente: process.env.EMAIL_USER });
};

const iniciar = async () => {
  const jwtSecret = infra.requerirEnv('JWT_SECRET');
  const origenPermitido = process.env.FRONTEND_URL || 'http://localhost:3000';
  const sequelize = infra.crearSequelize(infra.configDB(), { logging: process.env.NODE_ENV === 'development' && console.log });
  const modelos = infra.definirModelos(sequelize);
  await sequelize.authenticate();
  // En producción el esquema lo manejan las migraciones (npm run migrate)
  if (process.env.NODE_ENV === 'development') await sequelize.sync({ alter: true });

  const realtime = new infra.SocketIoRealtimeAdapter({ jwtSecret, origenPermitido });
  const { casos } = componer({
    sequelize, modelos, realtime, email: _crearEmail(), userDirectory: new infra.AuthcoreUserAdapter(infra.configAuthcore()),
  });
  const trustProxy = parseInt(process.env.TRUST_PROXY || '0', 10);
  const server = http.createServer(crearApp({ casos, jwtSecret, origenPermitido, trustProxy }));
  realtime.adjuntar(server);
  programarTareas({ casos });

  const puerto = process.env.PORT || 3003;
  server.listen(puerto, () => console.log(`domain-service escuchando en el puerto ${puerto}`));
};

iniciar().catch((error) => {
  console.error('domain-service: no se pudo iniciar:', error.message);
  process.exit(1);
});
