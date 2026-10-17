require('dotenv').config();
const http = require('http');
const Entorno = require('./src/infraestructura/configuracion/Entorno');
const { crearSequelize } = require('./src/infraestructura/persistencia/conexion');
const { definirModelos } = require('./src/infraestructura/persistencia/modelosSequelize');
const DirectorioAuthcore = require('./src/infraestructura/authcore/DirectorioAuthcore');
const CorreoSMTP = require('./src/infraestructura/correo/CorreoSMTP');
const CanalSocketIo = require('./src/infraestructura/tiempoReal/CanalSocketIo');
const Aplicacion = require('./src/Aplicacion');

const _crearCorreo = () => {
  const transporter = process.env.EMAIL_HOST
    ? CorreoSMTP.transporterSMTP({ host: process.env.EMAIL_HOST, port: process.env.EMAIL_PORT, user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS })
    : CorreoSMTP.transporterNulo;
  return new CorreoSMTP({ transporter, remitente: process.env.EMAIL_USER });
};

const iniciar = async () => {
  const jwtSecret = Entorno.requerir('JWT_SECRET');
  const origenPermitido = process.env.FRONTEND_URL || 'http://localhost:3000';
  const sequelize = crearSequelize(Entorno.baseDeDatos(), { logging: process.env.NODE_ENV === 'development' && console.log });
  const modelos = definirModelos(sequelize);
  await sequelize.authenticate();
  // En producción el esquema lo manejan las migraciones (npm run migrate)
  if (process.env.NODE_ENV === 'development') await sequelize.sync({ alter: true });

  const canal = new CanalSocketIo({ jwtSecret, origenPermitido });
  const aplicacion = new Aplicacion({ sequelize, modelos, canal, correo: _crearCorreo(), directorio: new DirectorioAuthcore(Entorno.authcore()) });
  const trustProxy = parseInt(process.env.TRUST_PROXY || '0', 10);
  const server = http.createServer(aplicacion.crearHttp({ jwtSecret, modulos: Entorno.modulos(), origenPermitido, trustProxy }));
  canal.adjuntar(server);
  aplicacion.crearProgramador().programar();

  const puerto = process.env.PORT || 3003;
  server.listen(puerto, () => console.log(`domain-service escuchando en el puerto ${puerto}`));
};

iniciar().catch((error) => {
  console.error('domain-service: no se pudo iniciar:', error.message);
  process.exit(1);
});
